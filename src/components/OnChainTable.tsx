import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SkeletonTable } from './Skeleton'

const PROXY = '/.netlify/functions/proxy?url='
const DEFAULT_ADDRESS = '0x1AB4973a48dc892Cd9971ECE8e01DcC7688f8F23'  // Bitget 6 wallet
const DEFAULT_TOKEN = '0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5'  // COAI token contract

// Shorten address
function short(s: string): string {
  return s ? s.slice(0, 10) + '...' + s.slice(-6) : '-'
}

// Time ago
function ago(timestamp: number): string {
  const d = Math.max(0, Date.now() - timestamp * 1000)
  const m = Math.floor(d / 60000)
  const h = Math.floor(m / 60)
  if (h > 0) return h + '시간 전'
  if (m > 0) return m + '분 전'
  return Math.floor(d / 1000) + '초 전'
}

// Format integer with commas
function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '-'
}

interface Transaction {
  hash: string
  timeStamp: string
  from: string
  to: string
  value: string
  tokenDecimal: string
}

async function fetchTransactions(
  address: string,
  token: string,
  page: number
): Promise<{ transactions: Transaction[]; error?: string }> {
  const qs = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    chainid: '56',  // BSC
    address,
    contractaddress: token,
    page: String(page),
    offset: '20',
    sort: 'desc',
  }).toString()

  const url = PROXY + encodeURIComponent('https://api.etherscan.io/v2/api?' + qs)

  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const data = await response.json()

  if (data.status === '1' && Array.isArray(data.result)) {
    return { transactions: data.result }
  }

  const msg = ((data.message || '') + ' ' + (data.result || '')).toLowerCase()
  if (msg.includes('invalid api key')) {
    return { transactions: [], error: 'API_KEY_REQUIRED' }
  }
  if (msg.includes('deprecated v1 endpoint')) {
    return { transactions: [], error: 'V1_DEPRECATED' }
  }
  if (msg.includes('free api access is temporarily unavailable')) {
    return { transactions: [], error: 'RATE_LIMIT' }
  }

  return { transactions: [] }
}

export default function OnChainTable() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS)
  const [token, setToken] = useState(DEFAULT_TOKEN)
  const [page, setPage] = useState(1)

  const watchAddress = address.toLowerCase()

  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['transactions', address, token, page],
    queryFn: () => fetchTransactions(address, token, page),
    refetchInterval: 30000,
    staleTime: 25000,
  })

  const handleLoad = useCallback(() => {
    setPage(1)
    refetch()
  }, [refetch])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '-'

  const renderError = () => {
    if (data?.error === 'API_KEY_REQUIRED') {
      return <tr><td colSpan={7} className="muted">API 키 오류 (환경변수 확인 필요)</td></tr>
    }
    if (data?.error === 'V1_DEPRECATED') {
      return (
        <tr>
          <td colSpan={7} className="muted">
            Etherscan V1 API가 중단되어 데이터를 불러올 수 없습니다.
          </td>
        </tr>
      )
    }
    if (data?.error === 'RATE_LIMIT') {
      return (
        <tr>
          <td colSpan={7} className="muted">
            API 사용량 제한 - 잠시 후 다시 시도해주세요.
          </td>
        </tr>
      )
    }
    if (error) {
      return <tr><td colSpan={7} className="muted">에러: {String(error)}</td></tr>
    }
    return null
  }

  return (
    <>
      <div className="row" style={{ gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span className="status ok" style={{ padding: '6px 12px' }}>Bitget 6</span>
        <input
          type="text"
          className="k"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="지갑 주소"
          style={{ flex: 1, minWidth: '200px' }}
        />
        <input
          type="text"
          className="k"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="토큰 주소"
          style={{ flex: 1, minWidth: '200px' }}
        />
        <button className="btn" onClick={handleLoad}>
          조회
        </button>
        <button className="btn" onClick={handleRefresh}>
          새로고침
        </button>
      </div>

      <div className="muted" style={{ marginBottom: '12px', fontSize: '13px' }}>
        🔄 <span className="k">30초</span> 자동 갱신 · 업데이트: <span className="k">{lastUpdated}</span>
        <br />
        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
          ⚠️ BSC Etherscan V2 · Netlify Functions 프록시 사용 (ETHERSCAN_KEY 또는 BSCSCAN_KEY 필요)
        </span>
      </div>

      {isLoading && !data ? (
        <SkeletonTable rows={5} cols={7} />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Txn</th>
                <th>시간</th>
                <th className="hide-mobile">From</th>
                <th className="hide-mobile">To</th>
                <th className="text-center">방향</th>
                <th className="text-right">수량</th>
                <th>링크</th>
              </tr>
            </thead>
            <tbody>
              {renderError() ? (
                renderError()
              ) : !data?.transactions.length ? (
                <tr>
                  <td colSpan={7} className="muted">트랜잭션 없음</td>
                </tr>
              ) : (
                data.transactions.map((tx) => {
                  const decimals = Number(tx.tokenDecimal || 18)
                  const amount = Number(tx.value) / 10 ** decimals
                  const from = (tx.from || '').toLowerCase()
                  const to = (tx.to || '').toLowerCase()
                  const direction = from === watchAddress ? 'OUT' : to === watchAddress ? 'IN' : '-'

                  return (
                    <tr key={tx.hash}>
                      <td className="k">
                        <a
                          className="link"
                          href={`https://bscscan.com/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {short(tx.hash)}
                        </a>
                      </td>
                      <td className="k">{ago(Number(tx.timeStamp))}</td>
                      <td className="k hide-mobile" title={tx.from}>
                        {from === watchAddress ? 'Bitget 6' : short(tx.from)}
                      </td>
                      <td className="k hide-mobile" title={tx.to}>
                        {to === watchAddress ? 'Bitget 6' : short(tx.to)}
                      </td>
                      <td className="text-center">
                        {direction === 'IN' ? (
                          <span className="status ok">IN</span>
                        ) : direction === 'OUT' ? (
                          <span className="status err">OUT</span>
                        ) : (
                          <span className="status">-</span>
                        )}
                      </td>
                      <td className="k text-right">{fmtInt(amount)}</td>
                      <td>
                        <a
                          className="link"
                          href={`https://bscscan.com/token/${token}?a=${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          보기 ↗
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="row row-between" style={{ marginTop: '16px' }}>
        <div className="muted">
          {page}페이지 · {data?.transactions.length || 0}건
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← 이전
          </button>
          <button className="btn" onClick={() => setPage((p) => p + 1)}>
            다음 →
          </button>
        </div>
      </div>
    </>
  )
}
