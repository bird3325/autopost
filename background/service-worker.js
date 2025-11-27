/**
 * Service Worker - Background Script
 * 확장 프로그램의 중앙 컨트롤러
 */

// 라이브러리 임포트 (background 폴더 기준 상대 경로)
importScripts(
    '../lib/logger.js',
    '../lib/utils.js',
    '../lib/storage.js',
    '../lib/crypto.js',
    '../lib/sheets-api.js',
    '../lib/scheduler.js',
    '../lib/job-queue.js',
    '../lib/platform-templates.js',
    '../lib/automation-engine.js'
);

// 확장 프로그램 설치 시
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        logger.info('확장 프로그램이 설치되었습니다');
        initializeExtension();
    } else if (details.reason === 'update') {
        logger.info('확장 프로그램이 업데이트되었습니다', {
            previousVersion: details.previousVersion
        });
    }
});

// 확장 프로그램 시작 시
chrome.runtime.onStartup.addListener(() => {
    logger.info('확장 프로그램이 시작되었습니다');
    scheduler.init();
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender, sendResponse);
    return true;
});

/**
 * 초기화
 */
async function initializeExtension() {
    try {
        const defaultSettings = {
            autoRun: true,
            notifications: true,
            retryOnError: true,
            maxRetries: 3,
            language: 'ko'
        };

        await storage.saveSettings(defaultSettings);
        scheduler.init();
        logger.info('초기화 완료');
    } catch (error) {
        logger.error('초기화 실패', { error: error.message });
    }
}

/**
 * 메시지 핸들러
 */
async function handleMessage(request, sender, sendResponse) {
    try {
        switch (request.type) {
            case 'AUTHENTICATE_SHEETS':
                await handleAuthenticateSheets(sendResponse);
                break;
            case 'READ_SHEET':
                await handleReadSheet(request, sendResponse);
                break;
            case 'CREATE_SCHEDULE':
                await handleCreateSchedule(request, sendResponse);
                break;
            case 'DELETE_SCHEDULE':
                await handleDeleteSchedule(request, sendResponse);
                break;
            case 'ADD_PLATFORM':
                await handleAddPlatform(request, sendResponse);
                break;
            case 'UPDATE_PLATFORM':
                await handleUpdatePlatform(request, sendResponse);
                break;
            case 'DELETE_PLATFORM':
                await handleDeletePlatform(request, sendResponse);
                break;
            case 'RUN_MANUAL':
                await handleRunManual(request, sendResponse);
                break;
            case 'RUN_AUTOMATION':
                await handleRunAutomation(request, sendResponse);
                break;
            case 'GET_LOGS':
                await handleGetLogs(request, sendResponse);
                break;
            case 'GET_JOB_HISTORY':
                await handleGetJobHistory(sendResponse);
                break;
            case 'GET_AUTH_STATUS':
                await handleGetAuthStatus(sendResponse);
                break;
            case 'GET_PLATFORMS':
                await handleGetPlatforms(sendResponse);
                break;
            case 'GET_SCHEDULES':
                await handleGetSchedules(sendResponse);
                break;
            case 'SAVE_SHEETS_CONFIG':
                await handleSaveSheetsConfig(request, sendResponse);
                break;
            case 'UPDATE_SCHEDULE':
                await handleUpdateSchedule(request, sendResponse);
                break;
            default:
                sendResponse({ success: false, error: '알 수 없는 요청 타입' });
        }
    } catch (error) {
        logger.error('메시지 처리 오류', { type: request.type, error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleAuthenticateSheets(sendResponse) {
    try {
        const token = await sheetsAPI.authenticate();
        logger.success('Google Sheets 인증 완료');
        sendResponse({ success: true, token });
    } catch (error) {
        logger.error('Google Sheets 인증 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleReadSheet(request, sendResponse) {
    try {
        const { url, range } = request;
        const spreadsheetId = sheetsAPI.extractSpreadsheetId(url);
        const rawData = await sheetsAPI.readSheet(spreadsheetId, range);
        const parsedData = sheetsAPI.parseSheetData(rawData);

        logger.success('시트 데이터 읽기 완료', { rowCount: parsedData.length });
        sendResponse({ success: true, data: parsedData });
    } catch (error) {
        logger.error('시트 데이터 읽기 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleCreateSchedule(request, sendResponse) {
    try {
        const schedule = request.schedule;
        await storage.addSchedule(schedule);

        const schedules = await storage.getSchedules();
        const savedSchedule = schedules[schedules.length - 1];
        await scheduler.createSchedule(savedSchedule);

        logger.success('스케줄 생성 완료', { scheduleId: savedSchedule.id });
        sendResponse({ success: true, schedule: savedSchedule });
    } catch (error) {
        logger.error('스케줄 생성 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleDeleteSchedule(request, sendResponse) {
    try {
        const { scheduleId } = request;
        await scheduler.deleteSchedule(scheduleId);
        await storage.deleteSchedule(scheduleId);

        logger.success('스케줄 삭제 완료', { scheduleId });
        sendResponse({ success: true });
    } catch (error) {
        logger.error('스케줄 삭제 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleAddPlatform(request, sendResponse) {
    try {
        const platform = request.platform;

        if (platform.credentials) {
            platform.credentials.username = await crypto_util.simpleEncrypt(platform.credentials.username);
            platform.credentials.password = await crypto_util.simpleEncrypt(platform.credentials.password);
        }

        await storage.addPlatform(platform);
        logger.success('플랫폼 추가 완료', { name: platform.name });
        sendResponse({ success: true });
    } catch (error) {
        logger.error('플랫폼 추가 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleUpdatePlatform(request, sendResponse) {
    try {
        const { platformId, updates } = request;

        if (updates.credentials) {
            updates.credentials.username = await crypto_util.simpleEncrypt(updates.credentials.username);
            updates.credentials.password = await crypto_util.simpleEncrypt(updates.credentials.password);
        }

        await storage.updatePlatform(platformId, updates);
        logger.success('플랫폼 업데이트 완료', { platformId });
        sendResponse({ success: true });
    } catch (error) {
        logger.error('플랫폼 업데이트 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleDeletePlatform(request, sendResponse) {
    try {
        const { platformId } = request;
        await storage.deletePlatform(platformId);

        logger.success('플랫폼 삭제 완료', { platformId });
        sendResponse({ success: true });
    } catch (error) {
        logger.error('플랫폼 삭제 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleRunManual(request, sendResponse) {
    try {
        const { platform, data } = request;

        const job = {
            id: Date.now() + Math.random(),
            type: 'manual_post',
            platform: platform,
            data: data,
            createdBy: 'manual'
        };

        const jobId = await jobQueue.enqueue(job);
        logger.info('수동 작업 추가됨', { jobId });
        sendResponse({ success: true, jobId });
    } catch (error) {
        logger.error('수동 실행 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleRunAutomation(request, sendResponse) {
    try {
        const { job } = request;

        if (job.platform?.credentials) {
            job.platform.credentials.username = await crypto_util.simpleDecrypt(job.platform.credentials.username);
            job.platform.credentials.password = await crypto_util.simpleDecrypt(job.platform.credentials.password);
        }

        const result = await automationEngine.execute(job);
        sendResponse({ success: true, result });
    } catch (error) {
        logger.error('자동화 실행 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetLogs(request, sendResponse) {
    try {
        const limit = request.limit || 100;
        const logs = await logger.getLogs(limit);
        sendResponse({ success: true, logs });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetJobHistory(sendResponse) {
    try {
        const history = await storage.getJobHistory();
        sendResponse({ success: true, history });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetAuthStatus(sendResponse) {
    try {
        const token = await storage.getAuthToken();
        sendResponse({ success: true, authenticated: !!token });
    } catch (error) {
        sendResponse({ success: false, authenticated: false });
    }
}

async function handleGetPlatforms(sendResponse) {
    try {
        const platforms = await storage.getPlatforms();
        sendResponse({ success: true, platforms });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetSchedules(sendResponse) {
    try {
        const schedules = await storage.getSchedules();
        sendResponse({ success: true, schedules });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSaveSheetsConfig(request, sendResponse) {
    try {
        const { config } = request;
        const spreadsheetId = sheetsAPI.extractSpreadsheetId(config.url);

        await storage.saveSheetsConfig({
            spreadsheetId,
            url: config.url,
            range: config.range,
            dateColumn: config.dateColumn
        });

        logger.success('Sheets 설정 저장 완료');
        sendResponse({ success: true });
    } catch (error) {
        logger.error('Sheets 설정 저장 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

async function handleUpdateSchedule(request, sendResponse) {
    try {
        const { scheduleId, updates } = request;
        await storage.updateSchedule(scheduleId, updates);
        await scheduler.restoreSchedules();

        logger.success('스케줄 업데이트 완료', { scheduleId });
        sendResponse({ success: true });
    } catch (error) {
        logger.error('스케줄 업데이트 실패', { error: error.message });
        sendResponse({ success: false, error: error.message });
    }
}

logger.info('Service Worker 시작됨');
