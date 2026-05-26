import { useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '../../store/useNotificationStore'
import { NotificationDropdown } from './NotificationDropdown'

interface NotificationBellProps {
  userId: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tNotifications: any
  getLabel: (type: string, actor: string, session: string) => string
}

export function NotificationBell({
  userId,
  open,
  onToggle,
  onClose,
  tNotifications,
  getLabel,
}: NotificationBellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadCount = useNotificationStore(state => state.unreadCount)

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
        aria-label={tNotifications.bellAriaLabel(unreadCount)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          userId={userId}
          onClose={onClose}
          tNotifications={tNotifications}
          getLabel={getLabel}
        />
      )}
    </div>
  )
}
