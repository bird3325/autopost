/**
 * Google Sheets API Integration
 * CSV export 방식으로 공개 시트 데이터 읽기
 */

class SheetsAPI {
    constructor() {
        // No token needed for public sheet CSV export
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
     * CSV 데이터를 파싱
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        const result = [];

        for (let line of lines) {
            const row = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        // Escaped quote
                        current += '"';
                        i++;
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // End of field
                    row.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            // Push last field
            row.push(current);
            result.push(row);
        }

        return result;
    }

    /**
     * 시트 데이터 읽기 (CSV export 사용)
     */
    async readSheet(spreadsheetId, range = 'Sheet1!A:Z') {
        try {
            // CSV export URL 구성
            // Range는 무시됨 (CSV는 전체 시트를 export)
            const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

            const response = await fetch(csvUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('시트를 찾을 수 없습니다. 공유 설정을 확인하세요.');
                } else if (response.status === 403) {
                    throw new Error('시트 접근 권한이 없습니다. "링크가 있는 모든 사용자"로 공유하세요.');
                }
                throw new Error(`시트 읽기 실패 (${response.status})`);
            }

            const csvText = await response.text();
            const parsedData = this.parseCSV(csvText);

            return parsedData;
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
