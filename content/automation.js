/**
 * Content Script - 페이지 내 자동화 수행
 */

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // async 함수를 즉시 실행하고 결과를 sendResponse로 전달
    handleAutomationMessage(request, sendResponse);
    // 비동기 응답을 기다리도록 true 반환
    return true;
});

/**
 * CodeMirror 에디터에 값 설정하는 헬퍼 함수
 */
async function setCodeMirrorValue(element, value) {
    console.log('[Auto-Post] ========== setCodeMirrorValue 시작 ==========');
    console.log('[Auto-Post] 설정할 값 길이:', value.length);
    console.log('[Auto-Post] 값 미리보기:', value.substring(0, 200));

    let codeMirrorInstance = null;

    // 방법 1: 페이지의 모든 CodeMirror 찾기
    const allCodeMirrors = document.querySelectorAll('.CodeMirror');
    console.log('[Auto-Post] 페이지의 .CodeMirror 개수:', allCodeMirrors.length);

    for (const cm of allCodeMirrors) {
        if (cm.CodeMirror) {
            codeMirrorInstance = cm.CodeMirror;
            console.log('[Auto-Post] ✓ CodeMirror 인스턴스 찾음!');
            break;
        }
    }

    // 방법 2: iframe 내부 검색
    if (!codeMirrorInstance) {
        const iframes = document.querySelectorAll('iframe');
        console.log('[Auto-Post] iframe 개수:', iframes.length);
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument) {
                    const cmInIframe = iframe.contentDocument.querySelectorAll('.CodeMirror');
                    for (const cm of cmInIframe) {
                        if (cm.CodeMirror) {
                            codeMirrorInstance = cm.CodeMirror;
                            console.log('[Auto-Post] ✓ iframe 내부에서 CodeMirror 찾음!');
                            break;
                        }
                    }
                }
            } catch (e) {
                // CORS 오류 무시
            }
            if (codeMirrorInstance) break;
        }
    }

    // CodeMirror 인스턴스로 값 설정
    if (codeMirrorInstance) {
        console.log('[Auto-Post] CodeMirror.setValue() 호출');
        codeMirrorInstance.setValue(value);
        codeMirrorInstance.refresh();

        // 값 확인
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentValue = codeMirrorInstance.getValue();
        console.log('[Auto-Post] ✓ 설정 완료! 현재 값 길이:', currentValue.length);
        console.log('[Auto-Post] 값 일치:', currentValue === value);
        return true;
    }

    console.error('[Auto-Post] CodeMirror를 찾을 수 없음');
    return false;
}

async function handleAutomationMessage(request, sendResponse) {
    try {
        let result;

        switch (request.action) {
            case 'LOGIN':
                result = await handleLogin(request);
                sendResponse({ success: true, ...result });
                break;
            case 'FILL_FORM':
                await handleFillForm(request);
                sendResponse({ success: true });
                break;
            case 'FILL_INPUT':
                await handleFillInput(request);
                sendResponse({ success: true });
                break;
            case 'FILL_CODEMIRROR':
                await handleFillCodeMirror(request);
                sendResponse({ success: true });
                break;
            case 'COPY_TO_CLIPBOARD':
                await handleCopyToClipboard(request);
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
        console.error('[Auto-Post] Automation error:', error);
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

async function handleFillCodeMirror(request) {
    const { selector, value } = request;
    console.log('[Auto-Post] handleFillCodeMirror 호출, 값 길이:', value.length);

    const success = await setCodeMirrorValue(null, value);

    if (!success) {
        throw new Error('CodeMirror 에디터를 찾을 수 없습니다');
    }

    console.log('[Auto-Post] CodeMirror filled 완료');
}

async function handleCopyToClipboard(request) {
    const { value } = request;
    console.log('[Auto-Post] 클립보드에 복사 중, 길이:', value.length);

    try {
        await navigator.clipboard.writeText(value);
        console.log('[Auto-Post] 클립보드 복사 성공');
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        console.log('[Auto-Post] 클립보드 복사 성공 (fallback)');
    }
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
