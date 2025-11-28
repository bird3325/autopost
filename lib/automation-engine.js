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
            // 사용자의 요청대로 로그인 창을 먼저 열어서 로그인 여부 확인
            // requireLogin이 true이면 loginUrl을 먼저 열고, 아니면 postUrl을 엽니다.
            let startUrl = platform.postUrl || platform.loginUrl;
            if (platform.requireLogin && platform.loginUrl) {
                startUrl = platform.loginUrl;
            }

            const tab = await this.openTab(startUrl);
            this.currentTabId = tab.id;

            // 2. 로그인 필요 여부 확인
            if (platform.requireLogin && platform.credentials) {
                await this.login(tab.id, platform);
            }

            // 3. 게시 페이지로 이동 
            // (시작 URL이 게시 URL이 아니거나, 로그인을 수행해서 페이지가 변경되었을 수 있으므로 이동)
            if (platform.postUrl && startUrl !== platform.postUrl) {
                await this.navigateTo(tab.id, platform.postUrl);
            }

            // 4. 액션 실행 (커스텀 액션이 정의된 경우)
            if (platform.actions && platform.actions.length > 0) {
                await this.executeActions(tab.id, platform.actions, job.data);
            } else {
                // 기존 방식 (폼 작성 -> 게시)
                await this.fillForm(tab.id, platform, job.data);

                if (platform.autoPublish) {
                    await this.publish(tab.id, platform);
                }
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
     * 액션 시퀀스 실행
     */
    async executeActions(tabId, actions, data) {
        if (typeof logger !== 'undefined') {
            await logger.info('액션 시퀀스 실행 시작', { count: actions.length });
        }

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'fill':
                        // 데이터 매핑 확인
                        const value = data[action.field] || action.value || '';
                        if (value) {
                            await this.sendToContentScript(tabId, {
                                action: 'FILL_INPUT',
                                selector: action.selector,
                                value: value
                            });
                        }
                        break;

                    case 'type':
                        // 타이핑 (사람처럼 입력)
                        const typeValue = data[action.field] || action.value || '';
                        if (typeValue) {
                            await this.sendToContentScript(tabId, {
                                action: 'TYPE',
                                selector: action.selector,
                                value: typeValue
                            });
                        }
                        break;

                    case 'click':
                        await this.sendToContentScript(tabId, {
                            action: 'CLICK',
                            selector: action.selector
                        });
                        break;

                    case 'clickText':
                        await this.sendToContentScript(tabId, {
                            action: 'CLICK_TEXT',
                            text: action.text,
                            parentSelector: action.parentSelector
                        });
                        break;

                    case 'wait':
                        await this.wait(action.ms || 1000);
                        break;

                    case 'navigate':
                        if (action.url) {
                            await this.navigateTo(tabId, action.url);
                        }
                        break;
                }

                // 각 액션 후 짧은 대기
                await this.wait(500);

            } catch (error) {
                if (typeof logger !== 'undefined') {
                    await logger.warning(`액션 실행 중 오류 (type: ${action.type})`, { error: error.message });
                }
                // 계속 진행할지 여부는 상황에 따라 다르지만, 일단 진행
            }
        }

        if (typeof logger !== 'undefined') {
            await logger.info('액션 시퀀스 실행 완료');
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
            const result = await this.sendToContentScript(tabId, {
                action: 'LOGIN',
                selectors: platform.selectors?.login || platform.template?.selectors?.login,
                username: credentials.username,
                password: credentials.password
            });

            if (result && result.executed) {
                // 로그인 수행됨
                await this.wait(3000);
                if (typeof logger !== 'undefined') {
                    await logger.success('로그인 완료', { platform: platform.name });
                }
            } else {
                // 로그인 건너뜀 (이미 로그인됨)
                if (typeof logger !== 'undefined') {
                    await logger.info('이미 로그인되어 있음 (로그인 건너뜀)', { platform: platform.name });
                }
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
                } else if (response && response.executed !== undefined) {
                    resolve(response); // 로그인 결과 등
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
