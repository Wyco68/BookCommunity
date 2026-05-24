

interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(Math.max((current / total) * 100, 0), 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span>{label}</span>
          <span>{current} / {total}</span>
        </div>
      ) : null}
      <div className="progress-track" style={{ width: '100%' }}>
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%`, transition: 'width 0.5s ease' }} 
        />
      </div>
    </div>
  )
}
