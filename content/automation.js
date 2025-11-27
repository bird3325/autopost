/**
 * Content Script - Automation Executor
 * 페이지에서 실제 자동화 작업 수행
 */

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleAutomationMessage(request, sendResponse);
    return true; // 비동기 응답
});

/**
 * 메시지 핸들러
 */
async function handleAutomationMessage(request, sendResponse) {
    try {
        switch (request.action) {
            case 'LOGIN':
                await handleLogin(request);
                sendResponse({ success: true });
                break;

            case 'FILL_FORM':
                await handleFillForm(request);
                sendResponse({ success: true });
                break;

            case 'CLICK':
                await handleClick(request);
                sendResponse({ success: true });
                break;

            case 'WAIT':
                await wait(request.ms || 1000);
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: '알 수 없는 액션' });
        }
    } catch (error) {
        console.error('Automation error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 로그인 처리
 */
async function handleLogin(request) {
    const { selectors, username, password } = request;

    // 사용자명 입력
    const usernameInput = await waitForElement(selectors.username);
    fillInput(usernameInput, username);

    // 대기
    await wait(500);

    // 비밀번호 입력
    const passwordInput = await waitForElement(selectors.password);
    fillInput(passwordInput, password);

    // 대기
    await wait(500);

    // 로그인 버튼 클릭
    const submitButton = await waitForElement(selectors.submitButton);
    clickElement(submitButton);

    console.log('Login executed');
}

/**
 * 폼 작성 처리
 */
async function handleFillForm(request) {
    const { selectors, data } = request;

    // 제목 입력
    if (selectors.title && data.title) {
        const titleInput = await waitForElement(selectors.title, 5000);
        fillInput(titleInput, data.title);
        await wait(300);
    }

    // 내용 입력
    if (selectors.content && data.content) {
        const contentInput = await waitForElement(selectors.content, 5000);

        // 에디터 타입에 따라 다르게 처리
        if (contentInput.contentEditable === 'true' || contentInput.isContentEditable) {
            // ContentEditable 에디터
            contentInput.innerHTML = data.content;
            contentInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // 일반 텍스트 입력
            fillInput(contentInput, data.content);
        }
        await wait(300);
    }

    // 카테고리 선택
    if (selectors.category && data.category) {
        try {
            const categorySelect = await waitForElement(selectors.category, 3000);
            selectOption(categorySelect, data.category);
            await wait(300);
        } catch (error) {
            console.warn('Category selection failed:', error);
        }
    }

    // 기타 커스텀 필드
    for (const [field, value] of Object.entries(data)) {
        if (field !== 'title' && field !== 'content' && field !== 'category' && selectors[field]) {
            try {
                const element = await waitForElement(selectors[field], 3000);
                fillInput(element, value);
                await wait(300);
            } catch (error) {
                console.warn(`Failed to fill field ${field}:`, error);
            }
        }
    }

    console.log('Form filled');
}

/**
 * 클릭 처리
 */
async function handleClick(request) {
    const { selector } = request;
    const element = await waitForElement(selector);
    clickElement(element);
    console.log('Click executed:', selector);
}

/**
 * 입력 필드 채우기
 */
function fillInput(element, value) {
    if (!element) return;

    // 기존 값 삭제
    element.value = '';

    // 새 값 입력
    element.value = value;

    // 이벤트 트리거 (React 등을 위해)
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * 선택 옵션 설정
 */
function selectOption(selectElement, value) {
    if (!selectElement) return;

    // 값으로 찾기
    for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].value === value ||
            selectElement.options[i].text === value) {
            selectElement.selectedIndex = i;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }
    }

    console.warn('Option not found:', value);
}

/**
 * 요소 클릭
 */
function clickElement(element) {
    if (!element) return;

    // 여러 방법으로 클릭 시도
    try {
        element.click();
    } catch (error) {
        // 대체 방법
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(clickEvent);
    }
}

/**
 * 요소 대기 (나타날 때까지)
 */
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
            return element;
        }
        await wait(100);
    }

    throw new Error(`Element ${selector} not found within ${timeout}ms`);
}

/**
 * 요소 가시성 확인
 */
function isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        element.offsetParent !== null;
}

/**
 * 대기 함수
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * iframe 내부 요소 찾기
 */
function findElementInIframe(selector, iframeSelector) {
    const iframe = document.querySelector(iframeSelector);
    if (!iframe) return null;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    return iframeDoc.querySelector(selector);
}

console.log('AutoPost Content Script loaded');
