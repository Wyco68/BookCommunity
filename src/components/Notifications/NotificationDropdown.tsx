import type { UseNotificationsReturn } from '../../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'

interface NotificationDropdownProps {
  notifState: UseNotificationsReturn
  onClose: () => void
  tNotifications: any
  getLabel: (type: string, actor: string, session: string) => string
}

export function NotificationDropdown({
  notifState,
  onClose,
  tNotifications,
  getLabel,
}: NotificationDropdownProps) {
  const { notifications, unreadCount, loading, hasMore, loadMore, markRead, markAllRead } = notifState

  const handleMarkAllRead = () => {
    void markAllRead()
  }

  const handleLoadMore = () => {
    void loadMore()
  }

  return (
    <div
      id="notification-dropdown"
      className="notif-dropdown"
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
              onRead={(id) => { void markRead(id) }}
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
