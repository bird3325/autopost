/**
 * Popup UI Logic
 */

// 전역 변수
let currentPlatforms = [];
let currentSchedules = [];
let currentSheets = [];
let editingSheetId = null;

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    registerEventListeners(); // Register listeners first
    initializeTabs();
    initializeModals();

    // Load data asynchronously
    await loadSheets();
    await loadPlatforms();
    await loadSchedules();
    await loadLogs();
});

// 탭 초기화
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
        });
    });
}

// 모달 초기화
function initializeModals() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').style.display = 'none');
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
}

// 이벤트 리스너
function registerEventListeners() {
    // Sheets
    document.getElementById('add-sheet-btn').addEventListener('click', () => {
        editingSheetId = null;
        document.getElementById('sheet-name').value = '';
        document.getElementById('sheet-url').value = '';
        document.getElementById('sheet-modal').style.display = 'flex';
    });
    document.getElementById('save-sheet-btn').addEventListener('click', saveSheet);

    // Platforms
    document.getElementById('add-platform-btn').addEventListener('click', () => { updateSheetOptions(); document.getElementById('platform-modal').style.display = 'flex'; });
    document.getElementById('save-platform-btn').addEventListener('click', savePlatform);
    document.getElementById('platform-type').addEventListener('change', updatePlatformFields);

    // Schedules
    document.getElementById('add-schedule-btn').addEventListener('click', () => { updateSchedulePlatformOptions(); document.getElementById('schedule-modal').style.display = 'flex'; });
    document.getElementById('save-schedule-btn').addEventListener('click', saveSchedule);
    document.getElementById('schedule-type').addEventListener('change', updateScheduleFields);

    // Logs
    document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
}

// 시트 로드
async function loadSheets() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SHEETS' });
        if (response && response.success) {
            currentSheets = response.sheets || [];
            renderSheets();
        }
    } catch (error) {
        console.error('Failed to load sheets:', error);
    }
}

// 시트 렌더링
function renderSheets() {
    const list = document.getElementById('sheet-list');
    if (currentSheets.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 시트가 없습니다</p><p class="text-muted">시트를 추가하여 자동 게시를 시작하세요</p></div>';
        return;
    }
    list.innerHTML = currentSheets.map(sheet => {
        const shortUrl = sheet.url.length > 45 ? sheet.url.substring(0, 42) + '...' : sheet.url;
        return `<div class="platform-item"><div class="platform-info"><h4>${sheet.name}</h4><p class="text-muted" style="font-size:11px;word-break:break-all">${shortUrl}</p></div><div class="platform-actions"><button class="btn btn-sm btn-secondary" data-action="edit-sheet" data-id="${sheet.id}">✏️</button><button class="btn btn-sm btn-danger" data-action="delete-sheet" data-id="${sheet.id}">🗑️</button></div></div>`;
    }).join('');

    // 이벤트 리스너 등록
    list.querySelectorAll('[data-action="edit-sheet"]').forEach(btn => {
        btn.addEventListener('click', () => editSheet(parseInt(btn.dataset.id)));
    });
    list.querySelectorAll('[data-action="delete-sheet"]').forEach(btn => {
        btn.addEventListener('click', () => deleteSheet(parseInt(btn.dataset.id)));
    });
}

// 시트 수정
function editSheet(sheetId) {
    const sheet = currentSheets.find(s => s.id === sheetId);
    if (!sheet) return;
    editingSheetId = sheetId;
    document.getElementById('sheet-name').value = sheet.name;
    document.getElementById('sheet-url').value = sheet.url;
    document.getElementById('sheet-modal').style.display = 'flex';
}

// 시트 저장
async function saveSheet() {
    try {
        const name = document.getElementById('sheet-name').value;
        const url = document.getElementById('sheet-url').value;
        if (!name) { showError('시트 이름을 입력하세요'); return; }
        if (!url) { showError('시트 URL을 입력하세요'); return; }
        showLoading('저장 중...');

        let response;
        if (editingSheetId) {
            response = await chrome.runtime.sendMessage({ type: 'UPDATE_SHEET', sheetId: editingSheetId, sheet: { name, url } });
        } else {
            response = await chrome.runtime.sendMessage({ type: 'ADD_SHEET', sheet: { name, url } });
        }

        if (response.success) {
            showSuccess(editingSheetId ? '시트가 수정되었습니다' : '시트가 추가되었습니다');
            document.getElementById('sheet-modal').style.display = 'none';
            document.getElementById('sheet-name').value = '';
            document.getElementById('sheet-url').value = '';
            editingSheetId = null;
            await loadSheets();
        } else {
            showError('저장 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 시트 삭제
async function deleteSheet(sheetId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
        const response = await chrome.runtime.sendMessage({ type: 'DELETE_SHEET', sheetId });
        if (response.success) {
            showSuccess('시트가 삭제되었습니다');
            await loadSheets();
        } else {
            showError('삭제 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    }
}

// 플랫폼 모달에서 시트 옵션 업데이트
function updateSheetOptions() {
    const select = document.getElementById('platform-sheet');
    select.innerHTML = '<option value="">시트를 선택하세요</option>' + currentSheets.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

// 플랫폼 로드
async function loadPlatforms() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_PLATFORMS' });
        if (response && response.success) {
            currentPlatforms = response.platforms || [];
            renderPlatforms();
        }
    } catch (error) {
        console.error('Failed to load platforms:', error);
    }
}

// 플랫폼 렌더링
function renderPlatforms() {
    const list = document.getElementById('platform-list');
    if (currentPlatforms.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 플랫폼이 없습니다</p><p class="text-muted">플랫폼을 추가하여 자동 게시를 시작하세요</p></div>';
        return;
    }
    list.innerHTML = currentPlatforms.map(platform => {
        const sheetName = platform.sheetId ? (currentSheets.find(s => s.id === platform.sheetId)?.name || '알 수 없음') : '시트 없음';
        return `<div class="platform-item"><div class="platform-info"><h4>${platform.name}</h4><p class="text-muted">시트: ${sheetName}</p><p class="text-muted">${platform.postUrl || platform.loginUrl}</p></div><div class="platform-actions"><button class="btn btn-sm btn-secondary" data-action="test-platform" data-id="${platform.id}">🧪</button><button class="btn btn-sm btn-danger" data-action="delete-platform" data-id="${platform.id}">🗑️</button></div></div>`;
    }).join('');

    // 이벤트 리스너 등록
    list.querySelectorAll('[data-action="test-platform"]').forEach(btn => {
        btn.addEventListener('click', () => testPlatform(Number(btn.dataset.id)));
    });
    list.querySelectorAll('[data-action="delete-platform"]').forEach(btn => {
        btn.addEventListener('click', () => deletePlatform(Number(btn.dataset.id)));
    });
}

// 플랫폼 필드 업데이트
function updatePlatformFields() { }

// 플랫폼 저장
async function savePlatform() {
    try {
        const sheetId = document.getElementById('platform-sheet').value;
        if (!sheetId) { showError('시트를 선택하세요'); return; }
        const platform = {
            sheetId: parseInt(sheetId),
            type: document.getElementById('platform-type').value,
            name: document.getElementById('platform-name').value,
            loginUrl: document.getElementById('login-url').value,
            postUrl: document.getElementById('post-url').value,
            requireLogin: document.getElementById('require-login').checked,
            autoPublish: document.getElementById('auto-publish').checked,
            credentials: {
                username: document.getElementById('platform-username').value,
                password: document.getElementById('platform-password').value
            },
            fieldMapping: {
                title: document.getElementById('map-title-col').value,
                link: document.getElementById('map-link-col').value,
                category: document.getElementById('map-category-col').value,
                tags: document.getElementById('map-tags-col').value
            }
        };
        if (!platform.name) { showError('플랫폼 이름을 입력하세요'); return; }
        showLoading('저장 중...');
        const response = await chrome.runtime.sendMessage({ type: 'ADD_PLATFORM', platform });
        if (response.success) {
            showSuccess('플랫폼이 추가되었습니다');
            document.getElementById('platform-modal').style.display = 'none';
            await loadPlatforms();
        } else {
            showError('저장 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 플랫폼 삭제
async function deletePlatform(platformId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
        const response = await chrome.runtime.sendMessage({ type: 'DELETE_PLATFORM', platformId });
        if (response.success) {
            showSuccess('플랫폼이 삭제되었습니다');
            await loadPlatforms();
        } else {
            showError('삭제 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    }
}

// 스케줄 로드
async function loadSchedules() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULES' });
        if (response && response.success) {
            currentSchedules = response.schedules || [];
            renderSchedules();
        }
    } catch (error) {
        console.error('Failed to load schedules:', error);
    }
}

// 스케줄 렌더링
function renderSchedules() {
    const list = document.getElementById('schedule-list');
    if (currentSchedules.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 스케줄이 없습니다</p><p class="text-muted">스케줄을 추가하여 자동 실행하세요</p></div>';
        return;
    }
    list.innerHTML = currentSchedules.map(schedule => `<div class="schedule-item"><div class="schedule-info"><h4>${schedule.platform?.name || '플랫폼'}</h4><p class="text-muted">${formatSchedule(schedule)}</p></div><div class="schedule-actions"><button class="btn btn-sm btn-primary" data-action="run-schedule" data-id="${schedule.id}" title="즉시 실행">⚡</button><label class="toggle"><input type="checkbox" ${schedule.enabled ? 'checked' : ''} data-action="toggle-schedule" data-id="${schedule.id}"><span class="toggle-slider"></span></label><button class="btn btn-sm btn-danger" data-action="delete-schedule" data-id="${schedule.id}">🗑️</button></div></div>`).join('');

    // 이벤트 리스너 등록
    list.querySelectorAll('[data-action="run-schedule"]').forEach(btn => {
        btn.addEventListener('click', () => executeSchedule(parseInt(btn.dataset.id)));
    });
    list.querySelectorAll('[data-action="toggle-schedule"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => toggleSchedule(parseInt(checkbox.dataset.id), checkbox.checked));
    });
    list.querySelectorAll('[data-action="delete-schedule"]').forEach(btn => {
        btn.addEventListener('click', () => deleteSchedule(parseInt(btn.dataset.id)));
    });
}

// 스케줄 즉시 실행
async function executeSchedule(scheduleId) {
    if (!confirm('지금 즉시 실행하시겠습니까?')) return;
    try {
        showLoading('실행 중...');
        const response = await chrome.runtime.sendMessage({ type: 'EXECUTE_SCHEDULE', scheduleId });
        if (response.success) {
            showSuccess('스케줄이 실행되었습니다. 로그를 확인하세요.');
            await loadLogs(); // 로그 탭 업데이트
        } else {
            showError('실행 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 스케줄 포맷팅
function formatSchedule(schedule) {
    if (schedule.type === 'daily') return `매일 ${schedule.time}`;
    if (schedule.type === 'interval') return `${schedule.intervalMinutes}분마다`;
    if (schedule.type === 'once') return `일회성 - ${new Date(schedule.runAt).toLocaleString()}`;
    return schedule.type;
}

// 스케줄 플랫폼 옵션 업데이트
function updateSchedulePlatformOptions() {
    const select = document.getElementById('schedule-platform');
    select.innerHTML = '<option value="">플랫폼을 선택하세요</option>' + currentPlatforms.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// 스케줄 필드 업데이트
function updateScheduleFields() {
    const type = document.getElementById('schedule-type').value;
    document.getElementById('daily-time-group').style.display = type === 'daily' ? 'block' : 'none';
    document.getElementById('interval-group').style.display = type === 'interval' ? 'block' : 'none';
    document.getElementById('once-datetime-group').style.display = type === 'once' ? 'block' : 'none';
}

// 스케줄 저장
async function saveSchedule() {
    try {
        const platformId = document.getElementById('schedule-platform').value;
        const type = document.getElementById('schedule-type').value;
        if (!platformId) { showError('플랫폼을 선택하세요'); return; }
        const platform = currentPlatforms.find(p => p.id == platformId);
        const schedule = { type, platform };
        if (type === 'daily') {
            const time = document.getElementById('schedule-time').value;
            if (!time) { showError('실행 시간을 입력하세요'); return; }
            schedule.time = time;
        }
        else if (type === 'interval') {
            const interval = parseInt(document.getElementById('schedule-interval').value);
            if (!interval || isNaN(interval) || interval < 1) { showError('올바른 실행 간격을 입력하세요'); return; }
            schedule.intervalMinutes = interval;
        }
        else if (type === 'once') {
            const runAt = document.getElementById('schedule-datetime').value;
            if (!runAt) { showError('실행 일시를 입력하세요'); return; }
            schedule.runAt = runAt;
        }
        showLoading('저장 중...');
        const response = await chrome.runtime.sendMessage({ type: 'CREATE_SCHEDULE', schedule });
        if (response.success) {
            showSuccess('스케줄이 추가되었습니다');
            document.getElementById('schedule-modal').style.display = 'none';
            await loadSchedules();
        } else {
            showError('저장 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 스케줄 토글
async function toggleSchedule(scheduleId, enabled) {
    try {
        await chrome.runtime.sendMessage({ type: 'UPDATE_SCHEDULE', scheduleId, updates: { enabled } });
        showSuccess(enabled ? '스케줄 활성화됨' : '스케줄 비활성화됨');
    } catch (error) {
        showError('오류: ' + error.message);
    }
}

// 스케줄 삭제
async function deleteSchedule(scheduleId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
        const response = await chrome.runtime.sendMessage({ type: 'DELETE_SCHEDULE', scheduleId });
        if (response.success) {
            showSuccess('스케줄이 삭제되었습니다');
            await loadSchedules();
        } else {
            showError('삭제 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    }
}

// 로그 로드
async function loadLogs() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_LOGS', limit: 50 });
        if (response && response.success) renderLogs(response.logs || []);
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

// 로그 렌더링
function renderLogs(logs) {
    const list = document.getElementById('log-list');
    if (logs.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>로그가 없습니다</p></div>';
        return;
    }
    list.innerHTML = logs.map(log => `<div class="log-item log-${log.level}"><div class="log-level-badge">${log.level.toUpperCase()}</div><div class="log-content"><p class="log-message">${log.message}</p><p class="log-time">${new Date(log.timestamp).toLocaleString()}</p></div></div>`).join('');
}

// UI 헬퍼
function showLoading(message) { console.log('Loading:', message); }
function hideLoading() { }
function showSuccess(message) { alert(message); }
function showError(message) { alert('오류: ' + message); }
