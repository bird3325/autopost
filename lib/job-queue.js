/**
 * Job Queue - 작업 큐 관리
 */

const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    RETRYING: 'retrying'
};

class JobQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.maxConcurrent = 1; // 동시 실행 제한
        this.currentRunning = 0;
    }

    /**
     * 작업 추가
     */
    async enqueue(job) {
        const jobWithMetadata = {
            id: job.id || (Date.now() + Math.random()),
            status: JOB_STATUS.PENDING,
            createdAt: new Date().toISOString(),
            retries: 0,
            maxRetries: job.maxRetries || 3,
            ...job
        };

        this.queue.push(jobWithMetadata);

        // 로그
        if (typeof logger !== 'undefined') {
            await logger.info('작업이 큐에 추가되었습니다', {
                jobId: jobWithMetadata.id,
                type: jobWithMetadata.type
            });
        }

        // 자동 처리 시작
        if (!this.isProcessing) {
            this.processQueue();
        }

        return jobWithMetadata.id;
    }

    /**
     * 큐 처리
     */
    async processQueue() {
        if (this.isProcessing) return;

        this.isProcessing = true;

        while (this.queue.length > 0 && this.currentRunning < this.maxConcurrent) {
            const job = this.queue.find(j => j.status === JOB_STATUS.PENDING);

            if (!job) break;

            // 작업 실행
            this.executeJob(job);
        }

        this.isProcessing = false;
    }

    /**
     * 작업 실행
     */
    async executeJob(job) {
        this.currentRunning++;
        job.status = JOB_STATUS.RUNNING;
        job.startedAt = new Date().toISOString();

        try {
            if (typeof logger !== 'undefined') {
                await logger.info('작업 실행 시작', {
                    jobId: job.id,
                    type: job.type,
                    platform: job.platform?.name
                });
            }

            // 작업 실행 (automation-engine에서 처리)
            await this.runJobTask(job);

            // 성공
            job.status = JOB_STATUS.COMPLETED;
            job.completedAt = new Date().toISOString();

            if (typeof logger !== 'undefined') {
                await logger.success('작업 완료', {
                    jobId: job.id,
                    duration: new Date(job.completedAt) - new Date(job.startedAt)
                });
            }

            // 작업 이력에 추가
            if (typeof storage !== 'undefined') {
                await storage.addJobHistory({
                    jobId: job.id,
                    type: job.type,
                    platform: job.platform?.name,
                    status: job.status,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt
                });
            }

        } catch (error) {
            // 실패
            if (typeof logger !== 'undefined') {
                await logger.error('작업 실패', {
                    jobId: job.id,
                    error: error.message,
                    retries: job.retries
                });
            }

            // 재시도 로직
            job.retries++;
            if (job.retries < job.maxRetries) {
                job.status = JOB_STATUS.RETRYING;

                // 재시도 대기 (지수 백오프)
                const delay = Math.min(1000 * Math.pow(2, job.retries), 30000);

                setTimeout(() => {
                    job.status = JOB_STATUS.PENDING;
                    this.processQueue();
                }, delay);

                if (typeof logger !== 'undefined') {
                    await logger.warning(`작업 재시도 대기 (${delay}ms 후)`, {
                        jobId: job.id,
                        retries: job.retries,
                        maxRetries: job.maxRetries
                    });
                }
            } else {
                job.status = JOB_STATUS.FAILED;
                job.completedAt = new Date().toISOString();
                job.error = error.message;

                // 작업 이력에 추가
                if (typeof storage !== 'undefined') {
                    await storage.addJobHistory({
                        jobId: job.id,
                        type: job.type,
                        platform: job.platform?.name,
                        status: job.status,
                        startedAt: job.startedAt,
                        completedAt: job.completedAt,
                        error: error.message
                    });
                }
            }
        } finally {
            this.currentRunning--;

            // 완료된 작업은 큐에서 제거 (실패 포함)
            if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) {
                this.queue = this.queue.filter(j => j.id !== job.id);
            }

            // 다음 작업 처리
            this.processQueue();
        }
    }

    /**
     * 실제 작업 실행 (automation-engine과 연동)
     */
    async runJobTask(job) {
        // Background context (Service Worker)
        if (typeof automationEngine !== 'undefined') {
            return automationEngine.execute(job);
        }

        // Fallback: Service worker에서 메시지 전송 (다른 컨텍스트에서 실행되는 경우)
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'RUN_AUTOMATION',
                job: job
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || '작업 실행 실패'));
                }
            });
        });
    }

    /**
     * 큐 상태 가져오기
     */
    getStatus() {
        return {
            total: this.queue.length,
            pending: this.queue.filter(j => j.status === JOB_STATUS.PENDING).length,
            running: this.queue.filter(j => j.status === JOB_STATUS.RUNNING).length,
            retrying: this.queue.filter(j => j.status === JOB_STATUS.RETRYING).length,
            isProcessing: this.isProcessing,
            currentRunning: this.currentRunning
        };
    }

    /**
     * 모든 작업 가져오기
     */
    getJobs() {
        return [...this.queue];
    }

    /**
     * 특정 작업 가져오기
     */
    getJob(jobId) {
        return this.queue.find(j => j.id === jobId);
    }

    /**
     * 작업 취소
     */
    cancelJob(jobId) {
        const job = this.queue.find(j => j.id === jobId);
        if (job && job.status === JOB_STATUS.PENDING) {
            this.queue = this.queue.filter(j => j.id !== jobId);

            if (typeof logger !== 'undefined') {
                logger.warning('작업 취소됨', { jobId });
            }

            return true;
        }
        return false;
    }

    /**
     * 큐 초기화
     */
    clear() {
        this.queue = [];
        this.isProcessing = false;
        this.currentRunning = 0;
    }
}

// Singleton 인스턴스
const jobQueue = new JobQueue();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = jobQueue;
}
