/**
 * Storage - Chrome Storage API 래퍼
 */

const STORAGE_KEYS = {
    SETTINGS: 'autopost_settings',
    PLATFORMS: 'autopost_platforms',
    SCHEDULES: 'autopost_schedules',
    JOB_HISTORY: 'autopost_job_history',
    SHEETS_CONFIG: 'autopost_sheets_config',
    AUTH_TOKEN: 'autopost_auth_token'
};

class Storage {
    /**
     * 데이터 저장
     */
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
            return false;
        }
    }

    /**
     * 데이터 가져오기
     */
    async get(key, defaultValue = null) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (error) {
            console.error(`Failed to get ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * 데이터 삭제
     */
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove ${key}:`, error);
            return false;
        }
    }

    /**
     * 모든 데이터 삭제
     */
    async clear() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear storage:', error);
            return false;
        }
    }

    // ===== 설정 관련 =====

    /**
     * 설정 저장
     */
    async saveSettings(settings) {
        return this.set(STORAGE_KEYS.SETTINGS, settings);
    }

    /**
     * 설정 가져오기
     */
    async getSettings() {
        return this.get(STORAGE_KEYS.SETTINGS, {
            autoRun: true,
            notifications: true,
            retryOnError: true,
            maxRetries: 3,
            language: 'ko'
        });
    }

    // ===== 플랫폼 관련 =====

    /**
     * 플랫폼 목록 저장
     */
    async savePlatforms(platforms) {
        return this.set(STORAGE_KEYS.PLATFORMS, platforms);
    }

    /**
     * 플랫폼 목록 가져오기
     */
    async getPlatforms() {
        return this.get(STORAGE_KEYS.PLATFORMS, []);
    }

    /**
     * 플랫폼 추가
     */
    async addPlatform(platform) {
        const platforms = await this.getPlatforms();
        platforms.push({
            id: Date.now() + Math.random(),
            createdAt: new Date().toISOString(),
            ...platform
        });
        return this.savePlatforms(platforms);
    }

    /**
     * 플랫폼 업데이트
     */
    async updatePlatform(id, updates) {
        const platforms = await this.getPlatforms();
        const index = platforms.findIndex(p => p.id === id);

        if (index !== -1) {
            platforms[index] = { ...platforms[index], ...updates };
            return this.savePlatforms(platforms);
        }

        return false;
    }

    /**
     * 플랫폼 삭제
     */
    async deletePlatform(id) {
        const platforms = await this.getPlatforms();
        const filtered = platforms.filter(p => p.id !== id);
        return this.savePlatforms(filtered);
    }

    // ===== 스케줄 관련 =====

    /**
     * 스케줄 목록 저장
     */
    async saveSchedules(schedules) {
        return this.set(STORAGE_KEYS.SCHEDULES, schedules);
    }

    /**
     * 스케줄 목록 가져오기
     */
    async getSchedules() {
        return this.get(STORAGE_KEYS.SCHEDULES, []);
    }

    /**
     * 스케줄 추가
     */
    async addSchedule(schedule) {
        const schedules = await this.getSchedules();
        schedules.push({
            id: Date.now() + Math.random(),
            createdAt: new Date().toISOString(),
            enabled: true,
            ...schedule
        });
        return this.saveSchedules(schedules);
    }

    /**
     * 스케줄 업데이트
     */
    async updateSchedule(id, updates) {
        const schedules = await this.getSchedules();
        const index = schedules.findIndex(s => s.id === id);

        if (index !== -1) {
            schedules[index] = { ...schedules[index], ...updates };
            return this.saveSchedules(schedules);
        }

        return false;
    }

    /**
     * 스케줄 삭제
     */
    async deleteSchedule(id) {
        const schedules = await this.getSchedules();
        const filtered = schedules.filter(s => s.id !== id);
        return this.saveSchedules(filtered);
    }

    // ===== 작업 이력 관련 =====

    /**
     * 작업 이력 저장
     */
    async saveJobHistory(history) {
        return this.set(STORAGE_KEYS.JOB_HISTORY, history);
    }

    /**
     * 작업 이력 가져오기
     */
    async getJobHistory(limit = 100) {
        const history = await this.get(STORAGE_KEYS.JOB_HISTORY, []);
        return history.slice(0, limit);
    }

    /**
     * 작업 이력 추가
     */
    async addJobHistory(job) {
        const history = await this.get(STORAGE_KEYS.JOB_HISTORY, []);
        history.unshift({
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            ...job
        });

        // 최대 1000개까지만 저장
        if (history.length > 1000) {
            history.splice(1000);
        }

        return this.saveJobHistory(history);
    }

    // ===== Google Sheets 설정 =====

    /**
     * Sheets 설정 저장
     */
    async saveSheetsConfig(config) {
        return this.set(STORAGE_KEYS.SHEETS_CONFIG, config);
    }

    /**
     * Sheets 설정 가져오기
     */
    async getSheetsConfig() {
        return this.get(STORAGE_KEYS.SHEETS_CONFIG, null);
    }

    // ===== 인증 토큰 =====

    /**
     * 인증 토큰 저장
     */
    async saveAuthToken(token) {
        return this.set(STORAGE_KEYS.AUTH_TOKEN, token);
    }

    /**
     * 인증 토큰 가져오기
     */
    async getAuthToken() {
        return this.get(STORAGE_KEYS.AUTH_TOKEN, null);
    }

    /**
     * 인증 토큰 삭제
     */
    async clearAuthToken() {
        return this.remove(STORAGE_KEYS.AUTH_TOKEN);
    }
}

// Singleton 인스턴스
const storage = new Storage();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storage;
}
