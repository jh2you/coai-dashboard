import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SkeletonTable } from './Skeleton'
import type { WalletBalanceResponse } from '../types'

const DEFAULT_WALLETS = 'Bitget:0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23,MEXC:0x4982085c9e2f89f2ecb8131eca71afad896e89cb,Gate.io:0x0D0707963952f2fBA59dD06f2b425ace40b492Fe'
const DEFAULT_CONTRACT = '0x0a8d6c86e1bce73fe4d0bd531e1a567306836ea5'  // COAI token contract

// Format with commas (integer)
function fmt(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '-'
  return Math.round(v).toLocaleString()
}

async function fetchWalletBalances(
  wallets: string,
  hours: number,
  contract: string
): Promise<WalletBalanceResponse> {
  const url = `/api/get-coai?wallets=${encodeURIComponent(wallets)}&hours=${hours}&contract=${encodeURIComponent(contract)}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  if (!data || !Array.isArray(data.results)) {
    throw new Error('Invalid response format')
  }

  return data
}

export default function WalletBalances() {
  const [wallets, setWallets] = useState(DEFAULT_WALLETS)
  const [hours, setHours] = useState(24)
  const [contract] = useState(DEFAULT_CONTRACT)

  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['walletBalances', wallets, hours, contract],
    queryFn: () => fetchWalletBalances(wallets, hours, contract),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })

  const handleLoad = useCallback(() => {
    refetch()
  }, [refetch])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : '-'

  // Calculate totals
  const totals = data?.results.reduce(
    (acc, r) => ({
      balance: acc.balance + Number(r.balance),
      totalIn: acc.totalIn + Number(r.totalIn),
      totalOut: acc.totalOut + Number(r.totalOut),
      netFlow: acc.netFlow + Number(r.netFlow),
    }),
    { balance: 0, totalIn: 0, totalOut: 0, netFlow: 0 }
  )

  return (
    <>
      <div className="row" style={{ gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="k"
          value={wallets}
          onChange={(e) => setWallets(e.target.value)}
          placeholder="거래소:지갑주소,..."
          style={{ flex: 1, minWidth: '250px' }}
        />
        <input
          type="number"
          className="k"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          min={1}
          style={{ width: '80px' }}
          title="시간 범위"
        />
        <span className="muted">시간</span>
        <button className="btn" onClick={handleLoad} disabled={isLoading}>
          {isLoading ? '로딩...' : '조회'}
        </button>
        <span className="muted">
          업데이트: {lastUpdated}
        </span>
      </div>

      {isLoading && !data ? (
        <SkeletonTable rows={4} cols={7} />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>거래소</th>
                <th className="hide-mobile">지갑</th>
                <th className="k text-right">잔고</th>
                <th className="k text-right hide-mobile">입금</th>
                <th className="k text-right hide-mobile">출금</th>
                <th className="k text-right">순유입</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--error)' }}>
                    에러: {String(error)}
                  </td>
                </tr>
              ) : !data?.results.length ? (
                <tr>
                  <td colSpan={7} className="muted">데이터 없음</td>
                </tr>
              ) : (
                data.results.map((r, i) => (
                  <tr key={r.wallet}>
                    <td>{i + 1}</td>
                    <td>{r.exchange}</td>
                    <td className="k hide-mobile" style={{ fontSize: '12px' }}>{r.wallet}</td>
                    <td className="k text-right">{fmt(r.balance)}</td>
                    <td className="k text-right hide-mobile">{fmt(r.totalIn)}</td>
                    <td className="k text-right hide-mobile">{fmt(r.totalOut)}</td>
                    <td
                      className="k text-right"
                      style={{
                        color: r.netFlow >= 0 ? 'var(--success)' : 'var(--error)',
                        fontWeight: 600,
                      }}
                    >
                      {r.netFlow >= 0 ? '+' : ''}{fmt(r.netFlow)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ background: 'var(--surface)' }}>
                  <td></td>
                  <td><strong>합계</strong></td>
                  <td className="hide-mobile"></td>
                  <td className="k text-right"><strong>{fmt(totals.balance)}</strong></td>
                  <td className="k text-right hide-mobile"><strong>{fmt(totals.totalIn)}</strong></td>
                  <td className="k text-right hide-mobile"><strong>{fmt(totals.totalOut)}</strong></td>
                  <td
                    className="k text-right"
                    style={{
                      color: totals.netFlow >= 0 ? 'var(--success)' : 'var(--error)',
                      fontWeight: 600,
                    }}
                  >
                    <strong>{totals.netFlow >= 0 ? '+' : ''}{fmt(totals.netFlow)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  )
}
