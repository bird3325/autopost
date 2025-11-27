/**
 * Google Sheets API Integration
 * OAuth 2.0 인증 및 시트 데이터 읽기
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

class SheetsAPI {
    constructor() {
        this.token = null;
    }

    /**
     * OAuth 2.0 인증
     */
    async authenticate() {
        try {
            // Chrome Identity API를 사용한 OAuth 인증
            const token = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(token);
                    }
                });
            });

            this.token = token;

            // 토큰 저장 (storage.js 사용)
            if (typeof storage !== 'undefined') {
                await storage.saveAuthToken(token);
            }

            return token;
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error('Google 인증에 실패했습니다: ' + error.message);
        }
    }

    /**
     * 저장된 토큰 로드
     */
    async loadToken() {
        if (typeof storage !== 'undefined') {
            this.token = await storage.getAuthToken();
        }
        return this.token;
    }

    /**
     * 토큰 제거 (로그아웃)
     */
    async revokeToken() {
        if (this.token) {
            try {
                await new Promise((resolve, reject) => {
                    chrome.identity.removeCachedAuthToken({ token: this.token }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });

                this.token = null;

                if (typeof storage !== 'undefined') {
                    await storage.clearAuthToken();
                }
            } catch (error) {
                console.error('Failed to revoke token:', error);
            }
        }
    }

    /**
     * 스프레드시트 ID 추출
     */
    extractSpreadsheetId(url) {
        // URL 형식: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit...
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return match[1];
        }

        // URL이 아닌 ID 자체일 수도 있음
        if (url && !url.includes('/')) {
            return url;
        }

        throw new Error('유효하지 않은 Google Sheets URL입니다');
    }

    /**
     * 시트 데이터 읽기
     */
    async readSheet(spreadsheetId, range = 'Sheet1!A:Z') {
        try {
            // 토큰이 없으면 인증
            if (!this.token) {
                await this.loadToken();
                if (!this.token) {
                    await this.authenticate();
                }
            }

            const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // 401 에러면 토큰 만료, 재인증
                if (response.status === 401) {
                    await this.authenticate();
                    return this.readSheet(spreadsheetId, range);
                }

                const errorText = await response.text();
                throw new Error(`Sheets API 오류 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error('Failed to read sheet:', error);
            throw error;
        }
    }

    /**
     * 시트 데이터를 객체 배열로 변환
     * 첫 번째 행을 헤더로 사용
     */
    parseSheetData(rawData) {
        if (!rawData || rawData.length === 0) {
            return [];
        }

        const headers = rawData[0];
        const rows = rawData.slice(1);

        return rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });
    }

    /**
     * 특정 날짜의 데이터만 필터링
     */
    filterByDate(data, dateColumn, targetDate) {
        if (!data || data.length === 0) {
            return [];
        }

        return data.filter(row => {
            const rowDate = row[dateColumn];
            if (!rowDate) return false;

            // 날짜 형식 정규화 (YYYY-MM-DD)
            const normalizedRowDate = this.normalizeDate(rowDate);
            const normalizedTargetDate = this.normalizeDate(targetDate);

            return normalizedRowDate === normalizedTargetDate;
        });
    }

    /**
     * 날짜 정규화 (다양한 형식 지원)
     */
    normalizeDate(dateString) {
        if (!dateString) return '';

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '';
            }

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        } catch (error) {
            return '';
        }
    }

    /**
     * 시트 정보 가져오기 (메타데이터)
     */
    async getSpreadsheetInfo(spreadsheetId) {
        try {
            if (!this.token) {
                await this.loadToken();
                if (!this.token) {
                    await this.authenticate();
                }
            }

            const url = `${SHEETS_API_BASE}/${spreadsheetId}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    await this.authenticate();
                    return this.getSpreadsheetInfo(spreadsheetId);
                }

                const errorText = await response.text();
                throw new Error(`Sheets API 오류 (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            return {
                title: data.properties.title,
                sheets: data.sheets.map(sheet => ({
                    title: sheet.properties.title,
                    sheetId: sheet.properties.sheetId,
                    index: sheet.properties.index
                }))
            };
        } catch (error) {
            console.error('Failed to get spreadsheet info:', error);
            throw error;
        }
    }

    /**
     * 편의 메서드: URL에서 데이터 읽기
     */
    async readSheetByUrl(url, range = 'Sheet1!A:Z') {
        const spreadsheetId = this.extractSpreadsheetId(url);
        return this.readSheet(spreadsheetId, range);
    }

    /**
     * 편의 메서드: 오늘 날짜 데이터 가져오기
     */
    async getTodayData(spreadsheetId, range = 'Sheet1!A:Z', dateColumn = '날짜') {
        const rawData = await this.readSheet(spreadsheetId, range);
        const parsedData = this.parseSheetData(rawData);

        const today = new Date().toISOString().split('T')[0];
        return this.filterByDate(parsedData, dateColumn, today);
    }
}

// Singleton 인스턴스
const sheetsAPI = new SheetsAPI();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = sheetsAPI;
}
