genspark_slider - 로컬 실행 가이드

이 프로젝트는 Genspark Slide를 PPT로 변환하는 도구입니다. 
Frontend(Client)와 Backend(Server)로 구성되어 있습니다.

## 📋 사전 요구 사항

- Node.js (v18 이상 권장)
- npm (Node.js 설치 시 함께 설치됨)

## 🚀 로컬 실행 방법

1. **의존성 패키지 설치**
   프로젝트 루트 디렉토리(C:\Users\hrdre\AI\genspark_slider)에서 다음 명령어를 실행하여 모든 패키지를 설치합니다.
   ```bash
   npm run install:all
   ```
   이 명령어는 루트, client, server 디렉토리의 모든 패키지를 한 번에 설치합니다.

2. **프로젝트 실행**
   패키지 설치가 완료되면 다음 명령어를 실행하여 서버와 클라이언트를 동시에 실행합니다.
   ```bash
   npm run dev
   ```

3. **접속 정보**
   - **Frontend**: http://localhost:5173
   - **Backend Server**: http://localhost:3000

## 📁 주요 디렉토리 구조

- `/client`: Vite 기반의 프론트엔드 실시간 편집기 및 미리보기
- `/server`: Puppeteer 및 pptxgenjs를 이용한 변환 서버
- `/server/output`: 생성된 PPT 및 이미지 파일이 저장되는 위치

## 🛠️ 문제 해결

- 만약 실행 시 포트 충돌이 발생하면, 다른 프로세스가 3000번이나 5173번 포트를 사용 중인지 확인하세요.
- 첫 실행 시 Puppeteer 라이브러리가 브라우저를 다운로드하므로 시간이 약간 소요될 수 있습니다.
