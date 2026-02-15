import { useState, useEffect } from 'react'

interface LastUpdatedProps {
  timestamp: number | null
  isLoading?: boolean
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 5) return '방금 전'
  if (seconds < 60) return `${seconds}초 전`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`
  return `${Math.floor(seconds / 3600)}시간 전`
}

export default function LastUpdated({ timestamp, isLoading }: LastUpdatedProps) {
  const [, setTick] = useState(0)

  // Update every second to keep time fresh
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!timestamp) return null

  return (
    <div className="last-updated">
      <span className={`update-dot ${isLoading ? 'loading' : ''}`} />
      <span className="update-text">
        {isLoading ? '업데이트 중...' : formatTimeAgo(timestamp)}
      </span>
    </div>
  )
}
