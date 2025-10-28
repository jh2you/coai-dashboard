# COAI 통합 대시보드 (Netlify + Supabase)

## 배포
1) 이 폴더를 Git 리포지토리에 푸시
2) Netlify에서 "New site from Git" → 리포 선택
3) 환경변수 추가
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE (또는 SUPABASE_KEY)
   - ETHERSCAN_KEY 또는 BSCSCAN_KEY
4) 배포 완료 후 `/.netlify/functions/*` 확인

## 구조
- index.html : 가격 표 + 스프레드 차트(시간축) + 온체인 테이블 + 저장/조회
- netlify/functions/proxy.js : 외부 API 프록시 (Etherscan V2 키 자동 주입)
- netlify/functions/savePrice.js : Supabase로 가격/스프레드 저장
- netlify/functions/getPrices.js : Supabase에서 과거 기록 조회
- netlify.toml : Functions 경로 지정


## COAI 전환 노트
- 모든 UI 및 심볼을 COAI로 표기하도록 변경
- 거래소 심볼: COAIUSDT로 갱신(MEXC/Gate.io/Bitget)
- 기본 지갑 주소: 0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23
- `coai/coai.js`의 `contract` 기본값을 `REPLACE_WITH_COAI_CONTRACT`로 두었습니다. 실제 COAI 컨트랙트 주소로 교체하세요.


## COAI 설정 가이드
- 기본 **COAI 컨트랙트 주소**는 프런트(`coai/coai.js`)에서 `localStorage.getItem("coai_contract")` → 미설정 시 `"REPLACE_WITH_COAI_CONTRACT"` 순으로 사용합니다.
  - 배포 후 브라우저 콘솔에서 예: `localStorage.setItem("coai_contract", "0x...실제주소")`
  - 또는 코드에서 기본값 문자열을 실제 COAI 컨트랙트 주소로 교체하십시오.
- **추가 거래소 연결**: `index.html`의 `EX` 배열에 `bybit/kucoin` 템플릿이 포함되어 있습니다. 상장/엔드포인트 확인 후 `enabled:true`로 전환하세요.
- 서버리스 `/api/tickers`에도 `bybit`, `kucoin`을 추가했습니다(실패 시 null 처리). 프론트가 필요 시 이 엔드포인트를 사용하도록 쉽게 전환할 수 있습니다.


## COAI 온체인 집계 기본 지갑
- MEXC: 0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB
- Bitget: 0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23
- Gate.io: 0x0D0707963952f2fBA59dD06f2b425ace40b492Fe
- Cold Wallet: 0xffa8DB7B38579e6A2D14f9B347a9acE4d044cD54

집계 테이블의 기본 wallets는 위 주소들로 설정되었습니다.


## 배포 요약 (Mac)
1) `deploy_mac.sh` 파일의 `GITHUB_USER`, `REPO_NAME`, `ETHERSCAN_KEY` 값을 본인 정보로 수정
2) 터미널에서 실행:
   ```bash
   ./deploy_mac.sh
   ```
3) 완료 후 Netlify 도메인에서 접속

### COAI 컨트랙트 주소 기본값
- 기본값: `0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5` (BSC)
- 필요 시 브라우저에서 덮어쓰기:
  ```js
  localStorage.setItem("coai_contract", "0x...원하는주소")
  ```
