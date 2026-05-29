import { useNotificationStore } from '../../store/useNotificationStore'
import { NotificationItem } from './NotificationItem'
import { useMotion } from '../../hooks/useMotion'

interface NotificationDropdownProps {
  userId: string
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tNotifications: any
  getLabel: (type: string, actor: string, session: string) => string
}

export function NotificationDropdown({
  userId,
  onClose,
  tNotifications,
  getLabel,
}: NotificationDropdownProps) {
  const canAnimate = useMotion()
  const notifications = useNotificationStore(state => state.notifications)
  const unreadCount = useNotificationStore(state => state.unreadCount)
  const loading = useNotificationStore(state => state.loading)
  const hasMore = useNotificationStore(state => state.hasMore)
  
  const fetchMore = useNotificationStore(state => state.fetchMore)
  const markRead = useNotificationStore(state => state.markRead)
  const markAllRead = useNotificationStore(state => state.markAllRead)

  const handleMarkAllRead = () => {
    if (userId) void markAllRead(userId)
  }

  const handleLoadMore = () => {
    if (userId) void fetchMore(userId)
  }

  return (
    <div
      id="notification-dropdown"
      className={`notif-dropdown ${canAnimate ? 'animate-dropdown' : ''}`}
      role="dialog"
      aria-label={tNotifications.panelAriaLabel}
    >
      <div className="notif-dropdown-header">
        <span className="notif-dropdown-title">{tNotifications.title}</span>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-mark-all-btn"
            onClick={handleMarkAllRead}
          >
            {tNotifications.markAllRead}
          </button>
        )}
      </div>

      <ul className="notif-list" role="list">
        {loading && notifications.length === 0 ? (
          <li className="notif-empty">
            <span className="spinner spinner-sm" aria-hidden="true" />
          </li>
        ) : notifications.length === 0 ? (
          <li className="notif-empty">{tNotifications.empty}</li>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={(id) => { if (userId) void markRead(id, userId) }}
              onNavigate={onClose}
              getLabel={getLabel}
              tNotifications={tNotifications}
            />
          ))
        )}
      </ul>

      {hasMore && (
        <div className="notif-load-more">
          <button
            type="button"
            className="notif-load-more-btn"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {tNotifications.loadMore}
          </button>
        </div>
      )}
    </div>
  )
}
