

interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(Math.max((current / total) * 100, 0), 100) : 0

  return (
    <div className="progress-bar">
      {label ? (
        <div className="progress-bar-label">
          <span>{label}</span>
          <span>{current} / {total}</span>
        </div>
      ) : null}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
