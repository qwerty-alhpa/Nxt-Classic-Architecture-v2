# 📚 BookLog - 나의 독서 기록 & AI 도서 추천

독서 기록을 저장하고, AI가 내 취향을 분석해 비슷한 책을 추천해주는 웹 애플리케이션입니다.

## 주요 기능

- **도서 등록**: 제목, 저자, 별점(1~5), 코멘트를 입력하여 독서 기록 저장
- **도서 목록 조회**: 등록한 도서를 최신순으로 확인
- **도서 삭제**: 개별 도서 기록 삭제
- **독서 통계**: 총 읽은 책, 평균 별점, 별점 분포 시각화, 최근 등록 도서
- **AI 도서 추천**: Lambda + Gemini AI가 독서 기록을 분석하여 비슷한 책 3권 추천

## 아키텍처

```
사용자 → S3 (프론트엔드)
         ↓ API 호출
       EC2 (도서 CRUD + 통계)
         ↓ AI 추천 요청 시
       Lambda + Gemini (AI 추천)

       EC2 ↔ RDS MySQL (데이터 저장)
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 18 (S3 정적 호스팅) |
| Backend | Node.js, Express (EC2) |
| Database | MySQL (AWS RDS) |
| AI | AWS Lambda + Google Gemini API |
| Infra | AWS EC2, RDS, S3, Lambda |

## AWS 리소스

- **S3**: 프론트엔드 정적 웹사이트 호스팅
- **EC2**: 백엔드 API 서버 (Express)
- **RDS**: MySQL 데이터베이스 (도서 기록 저장)
- **Lambda**: AI 도서 추천 함수 (Gemini API 호출)
- **보안 그룹**: SSH(22), HTTP(80), TCP(9080) 포트 개방

## 프로젝트 구조

```
5.BookLog/
├── server/
│   ├── server.js          # Express API 서버 (Lambda 함수 URL 호출)
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── client/
│   ├── public/
│   ├── src/
│   │   ├── App.js         # 메인 React 컴포넌트
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   └── README.md
├── lambda/
│   ├── index.js           # Lambda 함수 (Gemini AI 추천)
│   ├── package.json
│   └── README.md
├── .gitignore
└── README.md
```

## 실행 방법

### 1. Lambda 함수 배포

```bash
cd 5.BookLog/lambda
npm install
zip -r lambda.zip .
```
AWS 콘솔에서 Lambda 함수 생성 후 zip 업로드.
Lambda 환경변수 설정:
- `GEMINI_API_KEY`: Gemini API 키

Lambda 함수 URL을 생성하고 URL을 메모해둡니다.

### 2. 서버 설정 및 실행

```bash
cd 5.BookLog/server
npm install
cp .env.example .env
```

`.env` 파일에 값을 입력합니다:
```
DB_HOST=<RDS 엔드포인트>
DB_USER=<DB 사용자명>
DB_PASSWORD=<DB 비밀번호>
DB_NAME=<DB 이름>
LAMBDA_URL=<Lambda 함수 URL>
```

```bash
sudo node server.js
```

> `books` 테이블은 서버 시작 시 자동으로 생성됩니다.

### 3. 클라이언트 빌드 및 S3 배포

```bash
cd 5.BookLog/client
npm install
cp .env.example .env
```

`.env` 파일에 값을 입력합니다:
```
REACT_APP_SERVER_URL=http://<EC2 퍼블릭 IP>
```

```bash
npm run build
```
빌드된 `build/` 폴더 내용을 S3 버킷에 업로드합니다.

### 4. 접속

- 프론트엔드: S3 웹사이트 호스팅 URL
- 백엔드 API: http://<EC2 퍼블릭 IP>

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 서버 상태 확인 |
| GET | `/books` | 전체 도서 목록 조회 |
| POST | `/books` | 도서 등록 |
| DELETE | `/books/:id` | 도서 삭제 |
| GET | `/books/recommend` | AI 도서 추천 (Lambda) |
| GET | `/books/stats` | 독서 통계 |
