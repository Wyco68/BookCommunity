import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReadingSession } from '../types'
import { Spinner } from './Spinner'
import { useMotion } from '../hooks/useMotion'

interface JoinSessionModalProps {
  session: ReadingSession
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  cancelLabel: string
  titleLabel: string
  descOpen: string
  descRequest: string
}

export function JoinSessionModal({
  session,
  loading,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  titleLabel,
  descOpen,
  descRequest,
}: JoinSessionModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const canAnimate = useMotion()

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div
      className={`modal-overlay ${canAnimate ? 'animate-fade-in' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className={`modal-content join-modal ${canAnimate ? 'animate-scale-up' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="join-modal-header">
          <p className="eyebrow">{titleLabel}</p>
          <h3 className="join-modal-title">{session.book_title}</h3>
          <p className="subtle">{session.book_author}</p>
        </div>

        <div className="join-modal-policy">
          <span className={`pill join-modal-policy-pill${session.join_policy === 'request' ? ' join-modal-policy-request' : ''}`}>
            {session.join_policy === 'open' ? 'Open' : 'Request'}
          </span>
          <p className="muted join-modal-desc">
            {session.join_policy === 'open' ? descOpen : descRequest}
          </p>
        </div>

        <div className="modal-confirm-actions">
          <button
            ref={confirmRef}
            type="button"
            className="primary"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <Spinner size="xs" /> : confirmLabel}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
