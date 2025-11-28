/**
 * Content Script - 페이지 내 자동화 수행
 */

// 알림/확인 창 자동 차단 스크립트 주입
(function () {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            window.alert = function(msg) { console.log('[Auto-Post] Alert dismissed:', msg); return true; };
            window.confirm = function(msg) { console.log('[Auto-Post] Confirm dismissed (Cancel):', msg); return false; };
            window.prompt = function(msg) { console.log('[Auto-Post] Prompt dismissed (Cancel):', msg); return null; };
            
            // beforeunload 이벤트 차단
            window.addEventListener('beforeunload', function(e) {
                e.preventDefault();
                delete e['returnValue'];
            }, true);
            
            console.log('[Auto-Post] Alert blocker activated');
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
})();

// 페이지 로드 후 자동으로 팝업 닫기
window.addEventListener('load', function () {
    setTimeout(function () {
        console.log('[Auto-Post] Looking for popup to close...');

        // 방법 1: "취소" 텍스트로 검색
        let found = false;
        const buttons = document.querySelectorAll('button, a, .btn');
        for (const btn of buttons) {
            if (btn.textContent.trim() === '취소') {
                console.log('[Auto-Post] Found cancel button, clicking...');
                btn.click();
                found = true;
                break;
            }
        }

        if (!found) {
            console.log('[Auto-Post] No popup found');
        }
    }, 2000);
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleAutomationMessage(request, sendResponse);
    return true;
});

async function handleAutomationMessage(request, sendResponse) {
    try {
        switch (request.action) {
            case 'LOGIN':
                const loginResult = await handleLogin(request);
                sendResponse({ success: true, ...loginResult });
                break;
            case 'FILL_FORM':
                await handleFillForm(request);
                sendResponse({ success: true });
                break;
            case 'FILL_INPUT':
                await handleFillInput(request);
                sendResponse({ success: true });
                break;
            case 'TYPE':
                await handleType(request);
                sendResponse({ success: true });
                break;
            case 'CLICK':
                await handleClick(request);
                sendResponse({ success: true });
                break;
            case 'CLICK_TEXT':
                await handleClickByText(request);
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

async function handleLogin(request) {
    const { selectors, username, password } = request;
    try {
        const usernameInput = await waitForElement(selectors.username, 3000);
        fillInput(usernameInput, username);
        await wait(500);
        const passwordInput = await waitForElement(selectors.password);
        fillInput(passwordInput, password);
        await wait(500);
        const submitButton = await waitForElement(selectors.submitButton);
        clickElement(submitButton);
        console.log('Login executed');
        return { executed: true };
    } catch (error) {
        console.log('Login form not found, assuming already logged in');
        return { executed: false, reason: 'already_logged_in' };
    }
}

async function handleFillForm(request) {
    const { selectors, data } = request;
    if (selectors.title && data.title) {
        const titleInput = await waitForElement(selectors.title, 5000);
        fillInput(titleInput, data.title);
        await wait(300);
    }
    if (selectors.content && data.content) {
        const contentInput = await waitForElement(selectors.content, 5000);
        if (contentInput.contentEditable === 'true' || contentInput.isContentEditable) {
            contentInput.innerHTML = data.content;
            contentInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            fillInput(contentInput, data.content);
        }
        await wait(300);
    }
    console.log('Form filled');
}

async function handleFillInput(request) {
    const { selector, value } = request;
    const element = await waitForElement(selector, 5000);
    if (element.contentEditable === 'true' || element.isContentEditable) {
        element.innerHTML = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        fillInput(element, value);
    }
    console.log('Input filled:', selector);
}

async function handleType(request) {
    const { selector, value } = request;
    const element = await waitForElement(selector, 5000);
    element.focus();

    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (element.contentEditable === 'true' || element.isContentEditable) {
            document.execCommand('insertText', false, char);
        } else {
            const start = element.selectionStart || 0;
            const end = element.selectionEnd || 0;
            const text = element.value || '';
            element.value = text.substring(0, start) + char + text.substring(end);
            element.selectionStart = element.selectionEnd = start + 1;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const delay = Math.floor(Math.random() * 100) + 50;
        await wait(delay);
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log('Typing completed:', selector);
}

async function handleClick(request) {
    const { selector } = request;
    const element = await waitForElement(selector, 5000);
    clickElement(element);
    console.log('Clicked:', selector);
}

async function handleClickByText(request) {
    const { text } = request;
    const elements = document.querySelectorAll('button, a, div[role="option"], div[role="menuitem"], span');
    for (const el of elements) {
        if (el.textContent.includes(text)) {
            clickElement(el);
            console.log('Clicked element with text:', text);
            return;
        }
    }
    throw new Error(`Element with text "${text}" not found`);
}

function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found: ${selector}`));
        }, timeout);
    });
}

function fillInput(element, value) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickElement(element) {
    element.click();
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
