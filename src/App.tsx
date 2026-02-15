import { QueryClient, QueryClientProvider, useIsFetching } from '@tanstack/react-query'
import { ToastProvider } from './components/Toast'
import PriceTable from './components/PriceTable'
import SpreadChart from './components/SpreadChart'
import OpenInterestChart from './components/OpenInterestChart'
import AIAnalysis from './components/AIAnalysis'
import OnChainTable from './components/OnChainTable'
import WalletBalances from './components/WalletBalances'
import Collapsible from './components/Collapsible'
import LastUpdated from './components/LastUpdated'
import { usePrices } from './hooks/usePrices'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
})

function Dashboard() {
  const { dataUpdatedAt } = usePrices()
  const isFetching = useIsFetching()

  return (
    <div className="wrap">
      <div className="header-row">
        <div>
          <h1>COAI Live</h1>
          <div className="sub">
            실시간 가격 비교 · 괴리율 · 호가 비율 · 스프레드 · 미체결약정 · 온체인 트래킹
          </div>
          <LastUpdated timestamp={dataUpdatedAt} isLoading={isFetching > 0} />
        </div>
        <a
          href="https://myxdashboard.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-myx"
        >
          MYX Dashboard →
        </a>
      </div>

      {/* Price Table with Deviation and Order Book Gauge */}
      <PriceTable />

      {/* Spread Chart */}
      <SpreadChart />

      {/* Open Interest Chart - Collapsible */}
      <Collapsible title="미체결 약정 (Open Interest)" defaultOpen={false}>
        <OpenInterestChart />
        <AIAnalysis />
      </Collapsible>

      {/* On-Chain Transactions - Collapsible */}
      <Collapsible title="온체인 트랜잭션 (BSC)" defaultOpen={true}>
        <OnChainTable />
      </Collapsible>

      {/* CEX Wallet Balances - Collapsible */}
      <Collapsible title="CEX 지갑 잔고" defaultOpen={false}>
        <WalletBalances />
      </Collapsible>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </QueryClientProvider>
  )
}
