/**
 * Automation Engine - 플랫폼 자동화 실행 엔진
 */

class AutomationEngine {
    constructor() {
        this.currentTabId = null;
    }

    /**
     * 자동화 실행
     */
    async execute(job) {
        try {
            if (typeof logger !== 'undefined') {
                await logger.info('자동화 시작', {
                    jobId: job.id,
                    platform: job.platform?.name
                });
            }

            const platform = job.platform;

            if (!platform) {
                throw new Error('플랫폼 정보가 없습니다');
            }

            // 1. 새 탭 열기
            const tab = await this.openTab(platform.postUrl || platform.loginUrl);
            this.currentTabId = tab.id;

            // 2. 로그인 필요 여부 확인
            if (platform.requireLogin && platform.credentials) {
                await this.login(tab.id, platform);
            }

            // 3. 게시 페이지로 이동 (로그인과 다른 경우)
            if (platform.postUrl && platform.postUrl !== platform.loginUrl) {
                await this.navigateTo(tab.id, platform.postUrl);
            }

            // 4. 데이터 입력
            await this.fillForm(tab.id, platform, job.data);

            // 5. 게시
            if (platform.autoPublish) {
                await this.publish(tab.id, platform);
            }

            if (typeof logger !== 'undefined') {
                await logger.success('자동화 완료', { jobId: job.id });
            }

            return { success: true };

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('자동화 실패', {
                    jobId: job.id,
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * 새 탭 열기
     */
    async openTab(url) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // 페이지 로드 대기
                    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                        if (tabId === tab.id && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            resolve(tab);
                        }
                    });
                }
            });
        });
    }

    /**
     * URL로 이동
     */
    async navigateTo(tabId, url) {
        return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, { url }, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // 페이지 로드 대기
                    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
                        if (updatedTabId === tabId && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            resolve();
                        }
                    });
                }
            });
        });
    }

    /**
     * 로그인
     */
    async login(tabId, platform) {
        try {
            if (typeof logger !== 'undefined') {
                await logger.info('로그인 시작', { platform: platform.name });
            }

            const credentials = platform.credentials;

            if (!credentials || !credentials.username || !credentials.password) {
                throw new Error('로그인 정보가 없습니다');
            }

            // Content script에 로그인 명령 전송
            await this.sendToContentScript(tabId, {
                action: 'LOGIN',
                selectors: platform.selectors?.login || platform.template?.selectors?.login,
                username: credentials.username,
                password: credentials.password
            });

            // 로그인 완료 대기
            await this.wait(3000);

            if (typeof logger !== 'undefined') {
                await logger.success('로그인 완료', { platform: platform.name });
            }

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('로그인 실패', {
                    platform: platform.name,
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * 폼 작성
     */
    async fillForm(tabId, platform, data) {
        try {
            if (typeof logger !== 'undefined') {
                await logger.info('폼 작성 시작', { platform: platform.name });
            }

            const fieldMapping = platform.fieldMapping || {};
            const selectors = platform.selectors?.post || platform.template?.selectors?.post;

            // 데이터 매핑
            const mappedData = {};
            for (const [field, columnName] of Object.entries(fieldMapping)) {
                mappedData[field] = data[columnName] || '';
            }

            // Content script에 폼 작성 명령 전송
            await this.sendToContentScript(tabId, {
                action: 'FILL_FORM',
                selectors: selectors,
                data: mappedData
            });

            // 폼 작성 완료 대기
            await this.wait(2000);

            if (typeof logger !== 'undefined') {
                await logger.success('폼 작성 완료', { platform: platform.name });
            }

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('폼 작성 실패', {
                    platform: platform.name,
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * 게시
     */
    async publish(tabId, platform) {
        try {
            if (typeof logger !== 'undefined') {
                await logger.info('게시 시작', { platform: platform.name });
            }

            const publishButton = platform.selectors?.post?.publishButton ||
                platform.template?.selectors?.post?.publishButton;

            if (!publishButton) {
                throw new Error('게시 버튼 선택자가 없습니다');
            }

            // Content script에 게시 명령 전송
            await this.sendToContentScript(tabId, {
                action: 'CLICK',
                selector: publishButton
            });

            // 게시 완료 대기
            await this.wait(3000);

            if (typeof logger !== 'undefined') {
                await logger.success('게시 완료', { platform: platform.name });
            }

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('게시 실패', {
                    platform: platform.name,
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * Content script로 메시지 전송
     */
    async sendToContentScript(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Content script 실행 실패'));
                }
            });
        });
    }

    /**
     * 대기
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 탭 닫기
     */
    async closeCurrentTab() {
        if (this.currentTabId) {
            try {
                await chrome.tabs.remove(this.currentTabId);
                this.currentTabId = null;
            } catch (error) {
                console.error('Failed to close tab:', error);
            }
        }
    }
}

// Singleton 인스턴스
const automationEngine = new AutomationEngine();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = automationEngine;
}
