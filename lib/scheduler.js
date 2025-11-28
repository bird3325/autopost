/**
 * Scheduler - Chrome Alarms 기반 스케줄링 시스템
 */

class Scheduler {
    constructor() {
        this.alarmPrefix = 'autopost_';
    }

    /**
     * 초기화 - 리스너 등록
     */
    init() {
        // Alarm 이벤트 리스너
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // 저장된 스케줄 복원
        this.restoreSchedules();
    }

    /**
     * 스케줄 생성
     */
    async createSchedule(scheduleConfig) {
        try {
            const alarmName = this.alarmPrefix + scheduleConfig.id;

            // Alarm 생성
            if (scheduleConfig.type === 'once') {
                // 일회성 스케줄
                chrome.alarms.create(alarmName, {
                    when: new Date(scheduleConfig.runAt).getTime()
                });
            } else if (scheduleConfig.type === 'daily') {
                // 매일 반복
                const now = new Date();
                const [hours, minutes] = scheduleConfig.time.split(':');

                let when = new Date();
                when.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                // 오늘 시간이 지났으면 내일로
                if (when <= now) {
                    when.setDate(when.getDate() + 1);
                }

                chrome.alarms.create(alarmName, {
                    when: when.getTime(),
                    periodInMinutes: 24 * 60 // 24시간마다
                });
            } else if (scheduleConfig.type === 'interval') {
                // 주기적 반복
                chrome.alarms.create(alarmName, {
                    delayInMinutes: scheduleConfig.intervalMinutes,
                    periodInMinutes: scheduleConfig.intervalMinutes
                });
            }

            if (typeof logger !== 'undefined') {
                await logger.info('스케줄 생성됨', {
                    scheduleId: scheduleConfig.id,
                    type: scheduleConfig.type,
                    alarmName
                });
            }

            return true;
        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('스케줄 생성 실패', { error: error.message });
            }
            throw error;
        }
    }

    /**
     * 스케줄 삭제
     */
    async deleteSchedule(scheduleId) {
        try {
            const alarmName = this.alarmPrefix + scheduleId;
            await chrome.alarms.clear(alarmName);

            if (typeof logger !== 'undefined') {
                await logger.info('스케줄 삭제됨', { scheduleId, alarmName });
            }

            return true;
        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('스케줄 삭제 실패', { error: error.message });
            }
            return false;
        }
    }

    /**
     * 모든 스케줄 삭제
     */
    async clearAll() {
        try {
            const alarms = await chrome.alarms.getAll();
            const autopostAlarms = alarms.filter(a => a.name.startsWith(this.alarmPrefix));

            for (const alarm of autopostAlarms) {
                await chrome.alarms.clear(alarm.name);
            }

            if (typeof logger !== 'undefined') {
                await logger.info('모든 스케줄 삭제됨', { count: autopostAlarms.length });
            }

            return true;
        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('스케줄 일괄 삭제 실패', { error: error.message });
            }
            return false;
        }
    }

    /**
     * Alarm 핸들러
     */
    async handleAlarm(alarm) {
        // autopost 관련 알람만 처리
        if (!alarm.name.startsWith(this.alarmPrefix)) {
            return;
        }

        const scheduleId = alarm.name.replace(this.alarmPrefix, '');

        try {
            if (typeof logger !== 'undefined') {
                await logger.info('스케줄 실행', { scheduleId, alarmName: alarm.name });
            }

            // 저장된 스케줄 정보 가져오기
            if (typeof storage === 'undefined') {
                throw new Error('Storage not available');
            }

            const schedules = await storage.getSchedules();
            const schedule = schedules.find(s => String(s.id) === String(scheduleId));

            if (!schedule) {
                if (typeof logger !== 'undefined') {
                    await logger.warning('스케줄을 찾을 수 없음', { scheduleId });
                }
                return;
            }

            // 스케줄이 비활성화되어 있으면 스킵
            if (!schedule.enabled) {
                if (typeof logger !== 'undefined') {
                    await logger.info('비활성화된 스케줄 스킵', { scheduleId });
                }
                return;
            }

            // 작업 생성 및 큐에 추가
            await this.executeSchedule(schedule);

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('스케줄 실행 오류', {
                    scheduleId,
                    error: error.message
                });
            }
        }
    }

    /**
     * 스케줄 실행
     */
    async executeSchedule(schedule) {
        try {
            // Google Sheets에서 데이터 가져오기
            // 1. 플랫폼 정보에서 시트 ID 확인
            const sheetId = schedule.platform?.sheetId;

            // 시트 정보 가져오기 (플랫폼별 설정 우선, 없으면 전역 설정 시도)
            let sheetUrl;

            if (sheetId) {
                // 저장된 시트 목록에서 시트 정보 조회
                const sheets = await storage.get('autopost_sheets', []);
                const sheet = sheets.find(s => s.id === sheetId);

                if (!sheet) {
                    throw new Error(`연결된 시트를 찾을 수 없습니다 (ID: ${sheetId})`);
                }
                sheetUrl = sheet.url;
                if (typeof logger !== 'undefined') {
                    await logger.info(`[스케줄 ${schedule.id}] 시트 호출: ${sheet.name}`, { url: sheet.url });
                }
            } else {
                // 전역 설정 사용 (하위 호환성)
                const sheetsConfig = await storage.getSheetsConfig();
                if (!sheetsConfig) {
                    throw new Error('Google Sheets 설정이 없습니다 (플랫폼에 시트를 연결하거나 전역 설정을 하세요)');
                }
                sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetsConfig.spreadsheetId}/edit`;
                if (typeof logger !== 'undefined') {
                    await logger.info(`[스케줄 ${schedule.id}] 전역 시트 설정 사용`, { spreadsheetId: sheetsConfig.spreadsheetId });
                }
            }

            if (typeof sheetsAPI === 'undefined') {
                throw new Error('Sheets API not available');
            }

            // 오늘 날짜 데이터 가져오기 (기본 시트에서 날짜 컬럼으로 필터링)
            // 사용자가 "2025.11.28" 형식으로 날짜를 입력했다고 함
            const todayData = await sheetsAPI.getTodayData(
                sheetUrl,
                'Sheet1!A:Z', // 기본 범위
                '날짜', // 날짜 컬럼 이름
                null // 시트 탭 이름 (null이면 기본 시트 사용)
            );

            if (todayData.length === 0) {
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                if (typeof logger !== 'undefined') {
                    await logger.info(`오늘(${todayStr}) 실행할 데이터가 없습니다`, {
                        scheduleId: schedule.id,
                        sheetUrl: sheetUrl
                    });
                }
                return;
            }

            // 각 데이터에 대해 작업 생성
            for (const data of todayData) {
                // 플랫폼 템플릿 정보 병합 (selectors, actions 등 최신 로직 적용)
                let platformConfig = schedule.platform;
                if (typeof getPlatformTemplate === 'function' && schedule.platform.type) {
                    const template = getPlatformTemplate(schedule.platform.type);
                    if (template) {
                        platformConfig = {
                            ...template, // 템플릿 기본값
                            ...schedule.platform, // 사용자 설정 덮어쓰기
                            selectors: template.selectors, // 템플릿의 선택자 강제 사용 (최신 로직)
                            actions: template.actions,     // 템플릿의 액션 강제 사용 (최신 로직)
                            credentials: schedule.platform.credentials // 자격 증명은 사용자 설정 유지
                        };
                    }
                }

                const job = {
                    type: 'auto_post',
                    scheduleId: schedule.id,
                    platform: platformConfig,
                    data: data,
                    createdBy: 'scheduler'
                };

                // 작업 큐에 추가
                if (typeof jobQueue !== 'undefined') {
                    await jobQueue.enqueue(job);
                }
            }

            if (typeof logger !== 'undefined') {
                await logger.success('스케줄 작업 생성 완료', {
                    scheduleId: schedule.id,
                    jobCount: todayData.length
                });
            }

        } catch (error) {
            if (typeof logger !== 'undefined') {
                await logger.error('스케줄 실행 실패', {
                    scheduleId: schedule.id,
                    error: error.message
                });
            }
            throw error;
        }
    }

    /**
     * 저장된 스케줄 복원
     */
    async restoreSchedules() {
        try {
            if (typeof storage === 'undefined') {
                console.warn('Storage not available for restoring schedules');
                return;
            }

            const schedules = await storage.getSchedules();
            const enabledSchedules = schedules.filter(s => s.enabled);

            // 기존 알람 모두 삭제
            await this.clearAll();

            // 활성화된 스케줄만 재생성
            for (const schedule of enabledSchedules) {
                await this.createSchedule(schedule);
            }

            if (typeof logger !== 'undefined') {
                await logger.info('스케줄 복원 완료', {
                    total: schedules.length,
                    enabled: enabledSchedules.length
                });
            }
        } catch (error) {
            console.error('Failed to restore schedules:', error);
        }
    }

    /**
     * 현재 활성 알람 목록
     */
    async getActiveAlarms() {
        const alarms = await chrome.alarms.getAll();
        return alarms.filter(a => a.name.startsWith(this.alarmPrefix));
    }
}

// Singleton 인스턴스
const scheduler = new Scheduler();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = scheduler;
}
