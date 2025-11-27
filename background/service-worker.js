/**
 * Service Worker - Background Script
 */

console.log('Service Worker loaded successfully');

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);

    try {
        switch (request.type) {
            case 'GET_SHEETS':
                chrome.storage.local.get('autopost_sheets', (result) => {
                    sendResponse({ success: true, sheets: result.autopost_sheets || [] });
                });
                break;

            case 'ADD_SHEET':
                chrome.storage.local.get('autopost_sheets', (result) => {
                    const sheets = result.autopost_sheets || [];
                    const newSheet = {
                        id: Date.now(),
                        ...request.sheet
                    };
                    sheets.push(newSheet);
                    chrome.storage.local.set({ autopost_sheets: sheets }, () => {
                        sendResponse({ success: true, sheet: newSheet });
                    });
                });
                break;

            case 'UPDATE_SHEET':
                chrome.storage.local.get('autopost_sheets', (result) => {
                    const sheets = result.autopost_sheets || [];
                    const index = sheets.findIndex(s => s.id === request.sheetId);
                    if (index !== -1) {
                        sheets[index] = { ...sheets[index], ...request.sheet };
                        chrome.storage.local.set({ autopost_sheets: sheets }, () => {
                            sendResponse({ success: true });
                        });
                    } else {
                        sendResponse({ success: false, error: 'Sheet not found' });
                    }
                });
                break;

            case 'DELETE_SHEET':
                chrome.storage.local.get('autopost_sheets', (result) => {
                    const sheets = result.autopost_sheets || [];
                    const filtered = sheets.filter(s => s.id !== request.sheetId);
                    chrome.storage.local.set({ autopost_sheets: filtered }, () => {
                        sendResponse({ success: true });
                    });
                });
                break;

            case 'GET_PLATFORMS':
                chrome.storage.local.get('autopost_platforms', (result) => {
                    sendResponse({ success: true, platforms: result.autopost_platforms || [] });
                });
                break;

            case 'ADD_PLATFORM':
                chrome.storage.local.get('autopost_platforms', (result) => {
                    const platforms = result.autopost_platforms || [];
                    const newPlatform = {
                        id: Date.now(),
                        ...request.platform
                    };
                    platforms.push(newPlatform);
                    chrome.storage.local.set({ autopost_platforms: platforms }, () => {
                        sendResponse({ success: true });
                    });
                });
                break;

            case 'DELETE_PLATFORM':
                chrome.storage.local.get('autopost_platforms', (result) => {
                    const platforms = result.autopost_platforms || [];
                    const filtered = platforms.filter(p => p.id !== request.platformId);
                    chrome.storage.local.set({ autopost_platforms: filtered }, () => {
                        sendResponse({ success: true });
                    });
                });
                break;

            case 'GET_SCHEDULES':
                chrome.storage.local.get('autopost_schedules', (result) => {
                    sendResponse({ success: true, schedules: result.autopost_schedules || [] });
                });
                break;

            case 'GET_LOGS':
                chrome.storage.local.get('autopost_logs', (result) => {
                    const logs = result.autopost_logs || [];
                    sendResponse({ success: true, logs: logs.slice(0, request.limit || 50) });
                });
                break;

            case 'READ_SHEET':
                handleReadSheet(request.url).then(data => {
                    sendResponse({ success: true, data });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown request type' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }

    return true;
});

// Sheet reading function
async function handleReadSheet(url) {
    try {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            throw new Error('Invalid Google Sheets URL');
        }

        const spreadsheetId = match[1];
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

        const response = await fetch(csvUrl);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('시트를 찾을 수 없습니다. 공유 설정을 확인하세요.');
            } else if (response.status === 403) {
                throw new Error('시트 접근 권한이 없습니다. "링크가 있는 모든 사용자"로 공유하세요.');
            }
            throw new Error(`Failed to fetch sheet (${response.status})`);
        }

        const csvText = await response.text();
        const rows = parseCSV(csvText);

        if (rows.length === 0) return [];

        const headers = rows[0];
        const data = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });

        return data;
    } catch (error) {
        console.error('Error reading sheet:', error);
        throw error;
    }
}

// CSV parser
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const result = [];

    for (let line of lines) {
        const row = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        row.push(current);
        result.push(row);
    }

    return result;
}

console.log('Service Worker initialization complete');
