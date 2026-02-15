# COAI 대시보드 v2.0

React + TypeScript + Vite 기반의 COAI 실시간 대시보드

## 기능

- **실시간 가격 비교**: MEXC, Gate.io, Bitget, Binance(선물) 가격 모니터링
- **괴리율 표시**: Bitget 기준 타 거래소 가격 괴리율
- **호가 비율**: 매수/매도 호가 비율 게이지
- **스프레드 차트**: Bitget-Gate.io 스프레드 실시간 추적 (CSV 저장 지원)
- **온체인 트랜잭션**: BSC 네트워크 COAI 토큰 트랜잭션 조회
- **CEX 지갑 잔고**: 거래소 핫월렛 잔고 및 유입/유출 추적

## 기술 스택

- **Frontend**: React 19, TypeScript, Vite 7
- **State Management**: TanStack React Query
- **Charts**: Canvas API
- **Hosting**: Netlify (Functions 포함)

## 로컬 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# Netlify Functions와 함께 실행
npm run netlify-dev

# 프로덕션 빌드
npm run build
```

## 환경변수

Netlify 환경변수로 설정:

| 변수 | 설명 |
|------|------|
| `ETHERSCAN_KEY` | Etherscan API 키 (BSC 온체인 조회용) |
| `BSCSCAN_KEY` | BscScan API 키 (대체용) |

## 프로젝트 구조

```
coai-dashboard/
├── src/
│   ├── components/     # React 컴포넌트
│   │   ├── PriceTable.tsx      # 가격 테이블 + 괴리율 + 호가비율
│   │   ├── SpreadChart.tsx     # 스프레드 차트
│   │   ├── OnChainTable.tsx    # 온체인 트랜잭션
│   │   ├── WalletBalances.tsx  # CEX 지갑 잔고
│   │   ├── Collapsible.tsx     # 접이식 섹션
│   │   ├── Skeleton.tsx        # 로딩 스켈레톤
│   │   ├── Toast.tsx           # 토스트 알림
│   │   └── LastUpdated.tsx     # 마지막 업데이트 표시
│   ├── hooks/
│   │   └── usePrices.ts        # 가격/호가 데이터 훅
│   ├── types/
│   │   └── index.ts            # TypeScript 타입 정의
│   ├── App.tsx                 # 메인 앱 컴포넌트
│   ├── main.tsx                # 엔트리포인트
│   └── index.css               # 글로벌 스타일
├── netlify/
│   └── functions/
│       ├── proxy.js            # API 프록시 (CORS 우회)
│       └── get-coai.js         # CEX 지갑 잔고 집계
├── index.html                  # HTML 템플릿
├── vite.config.ts              # Vite 설정
├── tsconfig.json               # TypeScript 설정
├── netlify.toml                # Netlify 설정
└── package.json
```

## COAI 기본 설정

- **COAI 컨트랙트 (BSC)**: `0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5`
- **기본 추적 지갑 (Bitget 6)**: `0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23`

### CEX 핫월렛 주소

| 거래소 | 주소 |
|--------|------|
| Bitget | 0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23 |
| MEXC | 0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB |
| Gate.io | 0x0D0707963952f2fBA59dD06f2b425ace40b492Fe |

## 배포

1. GitHub 리포지토리에 푸시
2. Netlify에서 "New site from Git" → 리포 선택
3. 빌드 설정 확인:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 환경변수 추가 (`ETHERSCAN_KEY`)
5. 배포 완료

## 관련 프로젝트

- [MYX Dashboard](https://myxdashboard.netlify.app/) - MYX 토큰 대시보드
