/**
 * Draft Manager - Chrome Storage 기반 초안 관리
 */

const DraftManager = {
    STORAGE_KEY: 'autopost_drafts',

    /**
     * 모든 초안 가져오기
     */
    async getAll() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            return result[this.STORAGE_KEY] || [];
        } catch (error) {
            console.error('Failed to get drafts:', error);
            return [];
        }
    },

    /**
     * ID로 초안 가져오기
     */
    async getById(id) {
        const drafts = await this.getAll();
        return drafts.find(draft => draft.id === id);
    },

    /**
     * 새 초안 생성
     */
    async create(draftData) {
        try {
            const drafts = await this.getAll();
            const now = Date.now();
            const newDraft = {
                id: now,
                title: draftData.title || '',
                content: draftData.content || '',
                category: draftData.category || '',
                platformId: draftData.platformId || null,
                createdAt: now,
                updatedAt: now
            };

            drafts.push(newDraft);
            await chrome.storage.local.set({ [this.STORAGE_KEY]: drafts });
            return { success: true, draft: newDraft };
        } catch (error) {
            console.error('Failed to create draft:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 초안 업데이트
     */
    async update(id, updates) {
        try {
            const drafts = await this.getAll();
            const index = drafts.findIndex(draft => draft.id === id);

            if (index === -1) {
                return { success: false, error: 'Draft not found' };
            }

            drafts[index] = {
                ...drafts[index],
                ...updates,
                updatedAt: Date.now()
            };

            await chrome.storage.local.set({ [this.STORAGE_KEY]: drafts });
            return { success: true, draft: drafts[index] };
        } catch (error) {
            console.error('Failed to update draft:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 초안 삭제
     */
    async delete(id) {
        try {
            const drafts = await this.getAll();
            const filtered = drafts.filter(draft => draft.id !== id);

            await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
            return { success: true };
        } catch (error) {
            console.error('Failed to delete draft:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 모든 초안 삭제
     */
    async clear() {
        try {
            await chrome.storage.local.set({ [this.STORAGE_KEY]: [] });
            return { success: true };
        } catch (error) {
            console.error('Failed to clear drafts:', error);
            return { success: false, error: error.message };
        }
    }
};

// Export for use in service worker and popup
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DraftManager;
}
