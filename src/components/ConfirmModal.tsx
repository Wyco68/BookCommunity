import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
}

export function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  dangerous = false,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="modal-content modal-confirm">
        <p className="modal-confirm-message">{message}</p>
        <div className="modal-confirm-actions">
          <button
            ref={confirmRef}
            type="button"
            className={dangerous ? 'btn-danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
