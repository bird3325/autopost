/**
 * Utils - 공통 유틸리티 함수들
 */

/**
 * 날짜 포맷팅
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 오늘 날짜 가져오기 (YYYY-MM-DD)
 */
function getToday() {
    return formatDate(new Date(), 'YYYY-MM-DD');
}

/**
 * 딥 클론
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 디바운스
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 쓰로틀
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 대기 함수
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DOM 요소 대기 (selector가 나타날 때까지)
 */
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return element;
        }
        await wait(100);
    }

    throw new Error(`Element ${selector} not found within ${timeout}ms`);
}

/**
 * 랜덤 문자열 생성
 */
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 객체가 비어있는지 확인
 */
function isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    return Object.keys(obj).length === 0;
}

/**
 * 타입 체크
 */
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isArray(value) {
    return Array.isArray(value);
}

function isString(value) {
    return typeof value === 'string';
}

function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}

function isFunction(value) {
    return typeof value === 'function';
}

/**
 * URL 검증
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 에러 메시지 추출
 */
function getErrorMessage(error) {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error?.message) return error.error.message;
    return 'Unknown error';
}

/**
 * 안전한 JSON 파싱
 */
function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return defaultValue;
    }
}

/**
 * 배열을 청크로 나누기
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * 상대 시간 표시 (예: 2분 전, 1시간 전)
 */
function getRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    if (seconds > 0) return `${seconds}초 전`;
    return '방금 전';
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        getToday,
        deepClone,
        debounce,
        throttle,
        wait,
        waitForElement,
        generateId,
        isEmpty,
        isObject,
        isArray,
        isString,
        isNumber,
        isFunction,
        isValidUrl,
        getErrorMessage,
        safeJsonParse,
        chunkArray,
        getRelativeTime
    };
}
