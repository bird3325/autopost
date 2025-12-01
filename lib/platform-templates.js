/**
 * Platform Templates - 플랫폼별 자동화 템플릿
 */

const PLATFORM_TEMPLATES = {
    // 네이버 블로그
    naver_blog: {
        name: '네이버 블로그',
        loginUrl: 'https://nid.naver.com/nidlogin.login',
        postUrl: 'https://blog.naver.com/PostWriteForm.nhn',
        requireLogin: true,
        selectors: {
            login: {
                username: '#id',
                password: '#pw',
                submitButton: '.btn_login'
            },
            post: {
                title: '.se-documentTitle .se-ff-nanumgothic',
                content: '.se-main-container .se-text-paragraph',
                publishButton: '.publish_btn'
            }
        },
        actions: [
            { type: 'wait', ms: 3000 },
            { type: 'type', selector: '.se-documentTitle .se-ff-nanumgothic', field: 'title' },
            { type: 'wait', ms: 1000 },
            { type: 'clickText', text: '생활정보' },
            { type: 'wait', ms: 500 },
            { type: 'type', selector: '.se-main-container .se-text-paragraph', field: 'content' },
            { type: 'wait', ms: 2000 },
            { type: 'click', selector: '.publish_btn' },
            { type: 'wait', ms: 3000 }
        ]
    },

    // 티스토리
    tistory: {
        name: '티스토리',
        loginUrl: 'https://accounts.kakao.com/login?continue=https%3A%2F%2Fwww.tistory.com%2F',
        postUrl: 'https://www.tistory.com/manage/newpost',
        requireLogin: true,
        selectors: {
            login: {
                username: 'input[name="loginId"]',
                password: 'input[name="password"]',
                submitButton: 'button[type="submit"]'
            },
            post: {
                title: '#post-title-inp',
                content: '.CodeMirror',
                publishButton: '#publish-layer-btn'
            }
        },
        actions: [
            { type: 'wait', ms: 5000 },

            // 1. 모드 변경 (마크다운)
            // "기본모드" 클릭 -> "마크다운" 클릭
            { type: 'clickText', text: '기본모드' },
            { type: 'wait', ms: 1000 },
            { type: 'clickText', text: '마크다운' },
            { type: 'wait', ms: 2000 },

            // 2. 카테고리 선택
            // "카테고리" 텍스트 클릭하여 드롭다운 열기
            { type: 'clickText', text: '카테고리' },
            { type: 'wait', ms: 1000 },
            { type: 'clickText', field: 'category' },
            { type: 'wait', ms: 1000 },

            // 3. 제목 입력
            { type: 'click', selector: '#post-title-inp' },
            { type: 'wait', ms: 500 },
            { type: 'type', selector: '#post-title-inp', field: 'title' },
            { type: 'wait', ms: 1500 },

            // 4. 내용 입력
            { type: 'key', key: 'Tab' },
            { type: 'wait', ms: 500 },
            { type: 'fillCodeMirror', selector: 'body', field: 'content' },
            { type: 'wait', ms: 2000 },

            // 5. 태그 입력
            { type: 'click', selector: '#tag-input' },
            { type: 'wait', ms: 500 },
            { type: 'type', selector: '#tag-input', field: 'tags' },
            { type: 'wait', ms: 500 },
            { type: 'key', key: 'Enter' },
            { type: 'wait', ms: 1000 },

            // 6. 완료 버튼 (레이어 열기)
            { type: 'click', selector: '#publish-layer-btn' },
            { type: 'wait', ms: 1500 },

            // 7. 공개발행
            { type: 'click', selector: '#publish-btn' },
            { type: 'wait', ms: 3000 }
        ]
    },

    // 커스텀 플랫폼
    custom: {
        name: '커스텀',
        loginUrl: '',
        postUrl: '',
        selectors: {
            login: {
                username: '',
                password: '',
                submitButton: ''
            },
            post: {
                title: '',
                content: '',
                publishButton: ''
            }
        },
        actions: []
    }
};

function getPlatformTemplate(platformType) {
    return PLATFORM_TEMPLATES[platformType] || PLATFORM_TEMPLATES.custom;
}

function getAvailablePlatforms() {
    return Object.keys(PLATFORM_TEMPLATES).map(key => ({
        id: key,
        name: PLATFORM_TEMPLATES[key].name
    }));
}

function createCustomTemplate(config) {
    return {
        name: config.name || '커스텀',
        loginUrl: config.loginUrl || '',
        postUrl: config.postUrl || '',
        selectors: {
            login: {
                username: config.loginUsernameSelector || '',
                password: config.loginPasswordSelector || '',
                submitButton: config.loginSubmitSelector || ''
            },
            post: {
                title: config.postTitleSelector || '',
                content: config.postContentSelector || '',
                category: config.postCategorySelector || '',
                publishButton: config.postPublishSelector || ''
            }
        },
        actions: config.actions || []
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PLATFORM_TEMPLATES,
        getPlatformTemplate,
        getAvailablePlatforms,
        createCustomTemplate
    };
}
