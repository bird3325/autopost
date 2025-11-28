const sheetsAPI = require('./lib/sheets-api.js');

console.log('=== 날짜 형식 파싱 테스트 ===\n');

// 테스트 케이스
const testCases = [
    '11.28',
    '12.01',
    '1.5',
    '2025-11-28',
    '2025/11/28',
    'invalid'
];

testCases.forEach(dateStr => {
    const normalized = sheetsAPI.normalizeDate(dateStr);
    console.log(`입력: "${dateStr}" => 출력: "${normalized}"`);
});

// 오늘 날짜와 비교
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

console.log(`\n현재 날짜: ${todayStr}`);
console.log(`"11.28" 정규화: ${sheetsAPI.normalizeDate('11.28')}`);
console.log(`매칭 여부: ${sheetsAPI.normalizeDate('11.28') === todayStr ? '✅ 성공' : '❌ 실패'}`);
