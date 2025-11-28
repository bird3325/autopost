/**
 * Test script to verify sheet name detection
 * This script tests the ability to read from date-specific sheets like "11.28"
 */

// Load required modules
const fs = require('fs');
const path = require('path');

// Simulate browser globals for Node.js environment
global.fetch = require('node-fetch');

// Load sheets-api.js
const codeFile = fs.readFileSync(path.join(__dirname, 'lib', 'sheets-api.js'), 'utf8');
eval(codeFile);

// Test function
async function testSheetNameDetection() {
    console.log('=== Testing Sheet Name Detection ===\n');

    // You need to provide your actual Google Sheets ID here
    const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

    // Get today's date in MM.DD format
    const now = new Date();
    const month = String(now.getMonth() + 1);
    const day = String(now.getDate());
    const sheetNameByDate = `${month}.${day}`;

    console.log(`오늘 날짜: ${now.toLocaleDateString('ko-KR')}`);
    console.log(`찾을 시트명: "${sheetNameByDate}"\n`);

    try {
        // Test 1: Find sheet GID
        console.log('테스트 1: 시트 GID 찾기...');
        const gid = await sheetsAPI.findSheetGid(SPREADSHEET_ID, sheetNameByDate);

        if (gid) {
            console.log(`✅ 성공! GID: ${gid}\n`);
        } else {
            console.log(`❌ 실패: 시트 "${sheetNameByDate}"를 찾을 수 없습니다.\n`);
            console.log('다음 사항을 확인하세요:');
            console.log('1. Google Sheets에 해당 날짜의 시트 탭이 존재하는지');
            console.log(`2. 시트명이 정확히 "${sheetNameByDate}" 형식인지`);
            console.log('3. Sheets가 "링크가 있는 모든 사용자" 로 공유되어 있는지\n');
            return;
        }

        // Test 2: Read sheet data
        console.log('테스트 2: 시트 데이터 읽기...');
        const rawData = await sheetsAPI.readSheet(SPREADSHEET_ID, 'Sheet1!A:Z', sheetNameByDate);
        console.log(`✅ ${rawData.length}개의 행을 읽었습니다.\n`);

        // Test 3: Parse and filter data
        console.log('테스트 3: 데이터 파싱 및 필터링...');
        const parsedData = sheetsAPI.parseSheetData(rawData);
        console.log(`파싱된 데이터: ${parsedData.length}개의 행\n`);

        if (parsedData.length > 0) {
            console.log('첫 번째 데이터:');
            console.log(JSON.stringify(parsedData[0], null, 2));
        }

        // Test 4: Get today's data
        console.log('\n테스트 4: 오늘 날짜 데이터 가져오기...');
        const todayData = await sheetsAPI.getTodayData(
            SPREADSHEET_ID,
            'Sheet1!A:Z',
            '날짜',
            sheetNameByDate
        );
        console.log(`✅ 오늘 날짜 매칭 데이터: ${todayData.length}개\n`);

        if (todayData.length > 0) {
            console.log('오늘 날짜 데이터:');
            todayData.forEach((data, index) => {
                console.log(`\n[${index + 1}]`);
                console.log(JSON.stringify(data, null, 2));
            });
        } else {
            console.log('⚠️  오늘 날짜에 해당하는 데이터가 없습니다.');
        }

        console.log('\n=== 모든 테스트 완료 ===');

    } catch (error) {
        console.error('\n❌ 에러 발생:');
        console.error(error.message);
        console.error('\n스택 트레이스:');
        console.error(error.stack);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    console.log('사용법:');
    console.log('1. 이 파일에서 YOUR_SPREADSHEET_ID_HERE를 실제 스프레드시트 ID로 교체하세요');
    console.log('2. npm install node-fetch 를 실행하세요');
    console.log('3. node test_sheet_detection.js 를 실행하세요\n');

    // Uncomment the line below after setting up SPREADSHEET_ID
    // testSheetNameDetection();
}

module.exports = { testSheetNameDetection };
