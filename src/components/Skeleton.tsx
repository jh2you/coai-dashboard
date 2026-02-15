// Skeleton loading components

export function SkeletonLine({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: '4px' }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card">
      <SkeletonLine width="60%" height="14px" />
      <div style={{ marginTop: '12px' }}>
        <SkeletonLine width="80%" height="32px" />
      </div>
      <div style={{ marginTop: '8px' }}>
        <SkeletonLine width="40%" height="14px" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 4, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <SkeletonLine width="60px" height="14px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx}>
                  <SkeletonLine
                    width={colIdx === 0 ? '80px' : colIdx === cols - 1 ? '50px' : '100%'}
                    height="14px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonGauge() {
  return (
    <div className="gauge-container">
      <SkeletonLine width="32px" height="14px" />
      <div className="skeleton" style={{ flex: 1, height: '20px', borderRadius: '10px' }} />
      <SkeletonLine width="32px" height="14px" />
    </div>
  )
}
