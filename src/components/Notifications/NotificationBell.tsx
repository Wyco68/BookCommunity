import { useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import type { UseNotificationsReturn } from '../../hooks/useNotifications'
import { NotificationDropdown } from './NotificationDropdown'

interface NotificationBellProps {
  notifState: UseNotificationsReturn
  open: boolean
  onToggle: () => void
  onClose: () => void
  tNotifications: any
  getLabel: (type: string, actor: string, session: string) => string
}

export function NotificationBell({
  notifState,
  open,
  onToggle,
  onClose,
  tNotifications,
  getLabel,
}: NotificationBellProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div ref={containerRef} className="notif-bell" style={{ position: 'relative' }}>
      <button
        id="notification-bell-btn"
        type="button"
        className="notif-bell-btn"
        onClick={onToggle}
        aria-label={tNotifications.bellAriaLabel(notifState.unreadCount)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {notifState.unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {notifState.unreadCount > 99 ? '99+' : notifState.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifState={notifState}
          onClose={onClose}
          tNotifications={tNotifications}
          getLabel={getLabel}
        />
      )}
    </div>
  )
}
