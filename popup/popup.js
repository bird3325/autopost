/**
 * Popup UI Logic
 */

// 전역 변수
let currentPlatforms = [];
let currentSchedules = [];

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    initializeTabs();
    initializeModals();
    await loadAuthStatus();
    await loadPlatforms();
    await loadSchedules();
    await loadLogs();

    // 이벤트 리스너 등록
    registerEventListeners();
});

/**
 * 탭 초기화
 */
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 모든 탭 비활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // 클릭한 탭 활성화
            btn.classList.add('active');
            const tabId = btn.dataset.tab + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * 모달 초기화
 */
function initializeModals() {
    const closeBtns = document.querySelectorAll('.modal-close');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // 모달 외부 클릭 시 닫기
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

/**
 * 이벤트 리스너 등록
 */
function registerEventListeners() {
    // 시트 연결
    document.getElementById('auth-btn').addEventListener('click', handleAuth);
    document.getElementById('test-sheets-btn').addEventListener('click', testSheets);

    // 플랫폼
    document.getElementById('add-platform-btn').addEventListener('click', () => {
        document.getElementById('platform-modal').style.display = 'flex';
    });
    document.getElementById('save-platform-btn').addEventListener('click', savePlatform);
    document.getElementById('platform-type').addEventListener('change', updatePlatformFields);

    // 스케줄
    document.getElementById('add-schedule-btn').addEventListener('click', () => {
        updateSchedulePlatformOptions();
        document.getElementById('schedule-modal').style.display = 'flex';
    });
    document.getElementById('save-schedule-btn').addEventListener('click', saveSchedule);
    document.getElementById('schedule-type').addEventListener('change', updateScheduleFields);

    // 로그
    document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
}

/**
 * 인증 상태 로드
 */
async function loadAuthStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });

        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        const sheetsConfig = document.getElementById('sheets-config');

        if (response && response.authenticated) {
            statusDot.classList.add('connected');
            statusText.textContent = '연결됨';
            sheetsConfig.style.display = 'block';
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = '미연결';
            sheetsConfig.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load auth status:', error);
    }
}

/**
 * Google 인증
 */
async function handleAuth() {
    try {
        showLoading('인증 중...');

        const response = await chrome.runtime.sendMessage({ type: 'AUTHENTICATE_SHEETS' });

        if (response.success) {
            showSuccess('Google 계정 연결 완료!');
            await loadAuthStatus();
        } else {
            showError('인증 실패: ' + response.error);
        }
    } catch (error) {
        showError('인증 실패: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * 시트 데이터 테스트
 */
async function testSheets() {
    try {
        const url = document.getElementById('sheets-url').value;
        const range = document.getElementById('sheets-range').value;

        if (!url) {
            showError('시트 URL을 입력하세요');
            return;
        }

        showLoading('데이터 가져오는 중...');

        const response = await chrome.runtime.sendMessage({
            type: 'READ_SHEET',
            url,
            range
        });

        if (response.success) {
            const testResult = document.getElementById('test-result');
            testResult.innerHTML = `
        <div class="success-box">
          <p>✅ 데이터 읽기 성공!</p>
          <p>총 ${response.data.length}개 행이 발견되었습니다.</p>
          <pre>${JSON.stringify(response.data.slice(0, 3), null, 2)}</pre>
        </div>
      `;

            // 설정 저장
            await chrome.runtime.sendMessage({
                type: 'SAVE_SHEETS_CONFIG',
                config: {
                    url,
                    range,
                    dateColumn: document.getElementById('date-column').value
                }
            });

            showSuccess('시트 설정이 저장되었습니다');
        } else {
            showError('데이터 읽기 실패: ' + response.error);
        }
    } catch (error) {
        showError('오류: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * 플랫폼 로드
 */
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

/**
 * 플랫폼 렌더링
 */
function renderPlatforms() {
    const list = document.getElementById('platform-list');

    if (currentPlatforms.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <p>등록된 플랫폼이 없습니다</p>
        <p class="text-muted">플랫폼을 추가하여 자동 게시를 시작하세요</p>
      </div>
    `;
        return;
    }

    list.innerHTML = currentPlatforms.map(platform => `
    <div class="platform-item" data-id="${platform.id}">
      <div class="platform-info">
        <h4>${platform.name}</h4>
        <p class="text-muted">${platform.postUrl || platform.loginUrl}</p>
      </div>
      <div class="platform-actions">
        <button class="btn btn-sm btn-secondary" onclick="testPlatform(${platform.id})">
          🧪 테스트
        </button>
        <button class="btn btn-sm btn-danger" onclick="deletePlatform(${platform.id})">
          🗑️ 삭제
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * 플랫폼 필드 업데이트
 */
function updatePlatformFields() {
    const type = document.getElementById('platform-type').value;
    // 템플릿에 따라 URL 미리 채우기
    // TODO: 구현
}

/**
 * 플랫폼 저장
 */
async function savePlatform() {
    try {
        const platform = {
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
                content: document.getElementById('map-content-col').value
            }
        };

        if (!platform.name) {
            showError('플랫폼 이름을 입력하세요');
            return;
        }

        showLoading('저장 중...');

        const response = await chrome.runtime.sendMessage({
            type: 'ADD_PLATFORM',
            platform
        });

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

/**
 * 플랫폼 삭제
 */
async function deletePlatform(platformId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'DELETE_PLATFORM',
            platformId
        });

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

/**
 * 스케줄 로드
 */
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

/**
 * 스케줄 렌더링
 */
function renderSchedules() {
    const list = document.getElementById('schedule-list');

    if (currentSchedules.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <p>등록된 스케줄이 없습니다</p>
        <p class="text-muted">스케줄을 추가하여 자동 실행하세요</p>
      </div>
    `;
        return;
    }

    list.innerHTML = currentSchedules.map(schedule => `
    <div class="schedule-item" data-id="${schedule.id}">
      <div class="schedule-info">
        <h4>${schedule.platform?.name || '플랫폼'}</h4>
        <p class="text-muted">${formatSchedule(schedule)}</p>
      </div>
      <div class="schedule-actions">
        <label class="toggle">
          <input type="checkbox" ${schedule.enabled ? 'checked' : ''} 
                 onchange="toggleSchedule(${schedule.id}, this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn btn-sm btn-danger" onclick="deleteSchedule(${schedule.id})">
          🗑️ 삭제
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * 스케줄 포맷팅
 */
function formatSchedule(schedule) {
    if (schedule.type === 'daily') {
        return `매일 ${schedule.time}`;
    } else if (schedule.type === 'interval') {
        return `${schedule.intervalMinutes}분마다`;
    } else if (schedule.type === 'once') {
        return `일회성 - ${new Date(schedule.runAt).toLocaleString()}`;
    }
    return schedule.type;
}

/**
 * 스케줄 플랫폼 옵션 업데이트
 */
function updateSchedulePlatformOptions() {
    const select = document.getElementById('schedule-platform');
    select.innerHTML = '<option value="">플랫폼을 선택하세요</option>' +
        currentPlatforms.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

/**
 * 스케줄 필드 업데이트
 */
function updateScheduleFields() {
    const type = document.getElementById('schedule-type').value;

    document.getElementById('daily-time-group').style.display =
        type === 'daily' ? 'block' : 'none';
    document.getElementById('interval-group').style.display =
        type === 'interval' ? 'block' : 'none';
    document.getElementById('once-datetime-group').style.display =
        type === 'once' ? 'block' : 'none';
}

/**
 * 스케줄 저장
 */
async function saveSchedule() {
    try {
        const platformId = document.getElementById('schedule-platform').value;
        const type = document.getElementById('schedule-type').value;

        if (!platformId) {
            showError('플랫폼을 선택하세요');
            return;
        }

        const platform = currentPlatforms.find(p => p.id == platformId);
        const schedule = {
            type,
            platform
        };

        if (type === 'daily') {
            schedule.time = document.getElementById('schedule-time').value;
        } else if (type === 'interval') {
            schedule.intervalMinutes = parseInt(document.getElementById('schedule-interval').value);
        } else if (type === 'once') {
            schedule.runAt = document.getElementById('schedule-datetime').value;
        }

        showLoading('저장 중...');

        const response = await chrome.runtime.sendMessage({
            type: 'CREATE_SCHEDULE',
            schedule
        });

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

/**
 * 스케줄 토글
 */
async function toggleSchedule(scheduleId, enabled) {
    try {
        await chrome.runtime.sendMessage({
            type: 'UPDATE_SCHEDULE',
            scheduleId,
            updates: { enabled }
        });

        showSuccess(enabled ? '스케줄 활성화됨' : '스케줄 비활성화됨');
    } catch (error) {
        showError('오류: ' + error.message);
    }
}

/**
 * 스케줄 삭제
 */
async function deleteSchedule(scheduleId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'DELETE_SCHEDULE',
            scheduleId
        });

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

/**
 * 로그 로드
 */
async function loadLogs() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_LOGS',
            limit: 50
        });

        if (response && response.success) {
            renderLogs(response.logs || []);
        }
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

/**
 * 로그 렌더링
 */
function renderLogs(logs) {
    const list = document.getElementById('log-list');

    if (logs.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <p>로그가 없습니다</p>
      </div>
    `;
        return;
    }

    list.innerHTML = logs.map(log => `
    <div class="log-item log-${log.level}">
      <div class="log-level-badge">${log.level.toUpperCase()}</div>
      <div class="log-content">
        <p class="log-message">${log.message}</p>
        <p class="log-time">${new Date(log.timestamp).toLocaleString()}</p>
      </div>
    </div>
  `).join('');
}

/**
 * UI 헬퍼
 */
function showLoading(message) {
    // TODO: 로딩 오버레이 표시
    console.log('Loading:', message);
}

function hideLoading() {
    // TODO: 로딩 오버레이 숨기기
}

function showSuccess(message) {
    alert(message); // TODO: 토스트 알림으로 교체
}

function showError(message) {
    alert('오류: ' + message); // TODO: 토스트 알림으로 교체
}

// 전역 함수로 export (HTML onclick 이벤트용)
window.deletePlatform = deletePlatform;
window.testPlatform = () => { }; // TODO: 구현
window.toggleSchedule = toggleSchedule;
window.deleteSchedule = deleteSchedule;
