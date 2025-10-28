# COAI Dashboard — Netlify 배포 가이드 (GitHub 연동)
1. **이 폴더 전체를 GitHub 신규 리포지토리로 푸시**합니다.
   ```bash
   git init
   git add .
   git commit -m "Deploy COAI dashboard to Netlify"
   git branch -M main
   git remote add origin <YOUR_REPO_URL>
   git push -u origin main
   ```

2. **Netlify 대시보드 → Add new site → Import from Git**에서 위 리포를 선택합니다.
   - **빌드 설정**: 없음 (정적 사이트 + Netlify Functions)
   - **Base directory**: 루트
   - **Publish directory**: 루트 (index.html이 루트에 존재)
   - **Functions directory**: `netlify/functions`

3. **Environment variables** 설정
   - `ETHERSCAN_KEY` (또는 `BSCSCAN_KEY` — 체인에 맞게 선택)  
   - 필요 시 프록시 함수에서 호출하는 외부 API 키도 추가

4. 배포 후 `/.netlify/functions/*` 경로가 200으로 응답되는지 확인하세요.
   - 예: `/.netlify/functions/get-coai`
   - 예: `/.netlify/functions/proxy?url=https://api.mexc.com/...`

> 참고: 본 패치로 트랜잭션 표는 **데이터가 비어있어도 기존 내용 유지**, 잔고는 **현재/최대값**을 표시합니다.
