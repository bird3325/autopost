/**
 * Platform Templates - 플랫폼별 자동화 템플릿
 */

const PLATFORM_TEMPLATES = {
    // 네이버 블로그
    naver_blog: {
        name: '네이버 블로그',
        loginUrl: 'https://nid.naver.com/nidlogin.login',
        postUrl: 'https://blog.naver.com/PostWriteForm.nhn',
        selectors: {
            login: {
                username: '#id',
                password: '#pw',
                submitButton: '.btn_login'
            },
            post: {
                title: '#subject',
                content: '.se-component-content',
                category: '.category_select',
                publishButton: '.publish_btn'
            }
        },
        actions: [
            { type: 'fill', selector: '#subject', field: 'title' },
            { type: 'fill', selector: '.se-component-content', field: 'content' },
            { type: 'click', selector: '.publish_btn' },
            { type: 'wait', ms: 2000 }
        ]
    },

    // 티스토리
    tistory: {
        name: '티스토리',
        loginUrl: 'https://www.tistory.com/auth/login',
        postUrl: 'https://[blogname].tistory.com/manage/newpost/',
        selectors: {
            login: {
                username: '#loginId',
                password: '#loginPw',
                submitButton: '.btn_login'
            },
            post: {
                title: 'input[name="title"]',
                content: '#tinymce',
                category: 'select[name="category"]',
                publishButton: '#btn-publish'
            }
        },
        actions: [
            { type: 'fill', selector: 'input[name="title"]', field: 'title' },
            { type: 'fillFrame', selector: '#tinymce', field: 'content' },
            { type: 'click', selector: '#btn-publish' },
            { type: 'wait', ms: 2000 }
        ]
    },

    // 커스텀 플랫폼 (사용자 정의)
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

/**
 * 플랫폼 템플릿 가져오기
 */
function getPlatformTemplate(platformType) {
    return PLATFORM_TEMPLATES[platformType] || PLATFORM_TEMPLATES.custom;
}

/**
 * 사용 가능한 플랫폼 목록
 */
function getAvailablePlatforms() {
    return Object.keys(PLATFORM_TEMPLATES).map(key => ({
        id: key,
        name: PLATFORM_TEMPLATES[key].name
    }));
}

/**
 * 커스텀 플랫폼 템플릿 생성
 */
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

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PLATFORM_TEMPLATES,
        getPlatformTemplate,
        getAvailablePlatforms,
        createCustomTemplate
    };
}
