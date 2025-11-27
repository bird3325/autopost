# Auto-Post Extension 가이드

## 📦 설치

1. Chrome에서 `chrome://extensions` 접속
2. **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `d:/100 shop/extensions/autopost` 선택

## 🔧 Google Cloud 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 → **Google Sheets API** 활성화
3. **OAuth 클라이언트 ID** 생성 (Chrome 앱 유형)
4. 확장 프로그램 ID를 애플리케이션 ID에 입력
5. 생성된 클라이언트 ID를 `manifest.json`의 `oauth2.client_id`에 입력

## 사용법

### 1. Google Sheets 연결
- 🔐 계정 연결 → 시트 URL 입력 → 🧪 테스트

### 2. 플랫폼 추가
- 플랫폼 정보 입력, 필드 매핑 설정

### 3. 스케줄 설정  
- 매일/주기적/일회성 스케줄 선택

### 4. 로그 확인
- 실행 내역 및 오류 확인
