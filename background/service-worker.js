/**
 * Service Worker - Background Script
 */

// Import libraries
try {
    importScripts(
        '/lib/utils.js',
        '/lib/logger.js',
        '/lib/storage.js',
        '/lib/sheets-api.js',
        '/lib/platform-templates.js',
        '/lib/automation-engine.js',
        '/lib/debugger-controller.js',
        '/lib/job-queue.js',
        '/lib/scheduler.js'
    );
    console.log('Libraries imported successfully');
} catch (e) {
    console.error('Failed to import libraries:', e);
}

// Initialize Scheduler
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    // Initialize scheduler when service worker is activated
    if (typeof scheduler !== 'undefined') {
        scheduler.init();
    }
});

// Initialize scheduler if already active
if (typeof scheduler !== 'undefined') {
    scheduler.init();
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);

    // Async handler wrapper
    const handleAsync = async () => {
        try {
            switch (request.type) {
                // ===== Sheets =====
                case 'GET_SHEETS':
                    const sheets = await storage.get('autopost_sheets', []);
                    return { success: true, sheets };

                case 'ADD_SHEET':
                    const newSheet = {
                        id: Date.now(),
                        ...request.sheet
                    };
                    const currentSheets = await storage.get('autopost_sheets', []);
                    currentSheets.push(newSheet);
                    await storage.set('autopost_sheets', currentSheets);
                    return { success: true, sheet: newSheet };

                case 'UPDATE_SHEET':
                    const sheetsToUpdate = await storage.get('autopost_sheets', []);
                    const sheetIndex = sheetsToUpdate.findIndex(s => s.id === request.sheetId);
                    if (sheetIndex !== -1) {
                        sheetsToUpdate[sheetIndex] = { ...sheetsToUpdate[sheetIndex], ...request.sheet };
                        await storage.set('autopost_sheets', sheetsToUpdate);
                        return { success: true };
                    }
                    return { success: false, error: 'Sheet not found' };

                case 'DELETE_SHEET':
                    const sheetsToDelete = await storage.get('autopost_sheets', []);
                    const filteredSheets = sheetsToDelete.filter(s => s.id !== request.sheetId);
                    await storage.set('autopost_sheets', filteredSheets);
                    return { success: true };

                case 'READ_SHEET':
                    const data = await sheetsAPI.readSheetByUrl(request.url);
                    return { success: true, data };

                // ===== Platforms =====
                case 'GET_PLATFORMS':
                    const platforms = await storage.getPlatforms();
                    return { success: true, platforms };

                case 'ADD_PLATFORM':
                    await storage.addPlatform(request.platform);
                    return { success: true };

                case 'DELETE_PLATFORM':
                    await storage.deletePlatform(request.platformId);
                    return { success: true };

                // ===== Schedules =====
                case 'GET_SCHEDULES':
                    const schedules = await storage.getSchedules();
                    return { success: true, schedules };

                case 'CREATE_SCHEDULE':
                    const newSchedule = {
                        id: Date.now(),
                        createdAt: new Date().toISOString(),
                        enabled: true,
                        ...request.schedule
                    };

                    // 1. Save to storage
                    await storage.addSchedule(newSchedule);

                    // 2. Register alarm
                    await scheduler.createSchedule(newSchedule);

                    return { success: true, schedule: newSchedule };

                case 'UPDATE_SCHEDULE':
                    // 1. Update storage
                    await storage.updateSchedule(request.scheduleId, request.updates);

                    // 2. Re-register alarm (if needed)
                    // For simplicity, we can just get the updated schedule and recreate it
                    const allSchedules = await storage.getSchedules();
                    const updatedSchedule = allSchedules.find(s => s.id === request.scheduleId);

                    if (updatedSchedule) {
                        // If disabling, remove alarm
                        if (request.updates.enabled === false) {
                            await scheduler.deleteSchedule(request.scheduleId);
                        } else {
                            // Recreate alarm with new settings
                            await scheduler.deleteSchedule(request.scheduleId); // Clear old one first
                            await scheduler.createSchedule(updatedSchedule);
                        }
                    }

                    return { success: true };

                case 'DELETE_SCHEDULE':
                    // 1. Remove from storage
                    await storage.deleteSchedule(request.scheduleId);

                    // 2. Remove alarm
                    await scheduler.deleteSchedule(request.scheduleId);

                    return { success: true };

                case 'EXECUTE_SCHEDULE':
                    const schedulesToExec = await storage.getSchedules();
                    const scheduleToExec = schedulesToExec.find(s => s.id === request.scheduleId);

                    if (!scheduleToExec) {
                        return { success: false, error: 'Schedule not found' };
                    }

                    await scheduler.executeSchedule(scheduleToExec);
                    return { success: true };

                // ===== Logs =====
                case 'GET_LOGS':
                    const logs = await logger.getLogs(request.limit || 50);
                    return { success: true, logs };

                // ===== Automation =====
                case 'RUN_AUTOMATION':
                    await automationEngine.execute(request.job);
                    return { success: true };

                default:
                    return { success: false, error: 'Unknown request type: ' + request.type };
            }
        } catch (error) {
            console.error('Error handling message:', error);
            return { success: false, error: error.message };
        }
    };

    // Execute and send response
    handleAsync().then(sendResponse);
    return true; // Keep channel open for async response
});
