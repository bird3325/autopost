/**
 * Popup UI Logic
 */

// 전역 변수
let currentPlatforms = [];
let currentSchedules = [];
let currentSheets = [];

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    initializeTabs();
    initializeModals();
    await loadSheets();
    await loadPlatforms();
    await loadSchedules();
    await loadLogs();
    registerEventListeners();
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
    document.getElementById('add-sheet-btn').addEventListener('click', () => document.getElementById('sheet-modal').style.display = 'flex');
    document.getElementById('save-sheet-btn').addEventListener('click', saveSheet);
    document.getElementById('add-platform-btn').addEventListener('click', () => { updateSheetOptions(); document.getElementById('platform-modal').style.display = 'flex'; });
    document.getElementById('save-platform-btn').addEventListener('click', savePlatform);
    document.getElementById('platform-type').addEventListener('change', updatePlatformFields);
    document.getElementById('add-schedule-btn').addEventListener('click', () => { updateSchedulePlatformOptions(); document.getElementById('schedule-modal').style.display = 'flex'; });
    document.getElementById('save-schedule-btn').addEventListener('click', saveSchedule);
    document.getElementById('schedule-type').addEventListener('change', updateScheduleFields);
    document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
}

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

function renderSheets() {
    const list = document.getElementById('sheet-list');
    if (currentSheets.length === 0) {
        list.innerHTML = '<div class=\"empty-state\"><p>등록된 시트가 없습니다</p><p class=\"text-muted\">시트를 추가하여 자동 게시를 시작하세요</p></div>';
        return;
    }
    list.innerHTML = currentSheets.map(sheet => {
        const shortUrl = sheet.url.length > 45 ? sheet.url.substring(0, 42) + '...' : sheet.url;
        return `<div class=\"platform-item\"><div class=\"platform-info\"><h4></h4><p class=\"text-muted\" style=\"font-size:11px;word-break:break-all\"></p></div><div class=\"platform-actions\"><button class=\"btn btn-sm btn-danger\" onclick=\"deleteSheet()\"> 삭제</button></div></div>`;
    }).join('');
}
