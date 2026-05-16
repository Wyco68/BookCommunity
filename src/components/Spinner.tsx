type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  label?: string
  /** Show the label text next to the spinner */
  showLabel?: boolean
  className?: string
}

export function Spinner({ size = 'sm', label = 'Loading…', showLabel = false, className }: SpinnerProps) {
  if (showLabel) {
    return (
      <div className={`spinner-row ${className ?? ''}`} role="status" aria-label={label}>
        <span className={`spinner spinner-${size}`} aria-hidden="true" />
        <span>{label}</span>
      </div>
    )
  }

  return (
    <span
      className={`spinner spinner-${size} ${className ?? ''}`}
      role="status"
      aria-label={label}
    />
  )
}

/** Full section-height centered spinner */
export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-page" role="status" aria-label={label}>
      <span className="spinner spinner-md" aria-hidden="true" />
      <span className="muted">{label}</span>
    </div>
  )
}
