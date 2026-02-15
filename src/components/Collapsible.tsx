import { useState, ReactNode } from 'react'

interface CollapsibleProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function Collapsible({ title, defaultOpen = true, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="card card-spacing collapsible">
      <button
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h2 style={{ margin: 0, fontSize: '18px' }}>{title}</h2>
        <span className={`collapsible-icon ${isOpen ? 'open' : ''}`}>
          ▼
        </span>
      </button>
      <div className={`collapsible-content ${isOpen ? 'open' : ''}`}>
        {children}
      </div>
    </div>
  )
}
