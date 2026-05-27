import { useNavigate } from 'react-router-dom'
import { Bell, BookOpen, Heart, MessageCircle, Trash2, UserPlus } from 'lucide-react'
import { formatTimeAgo } from '../../lib/formatTimeAgo'
import type { Notification, NotificationEventType } from '../../types'

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
  onNavigate?: () => void
  getLabel: (type: string, actor: string, session: string) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tNotifications: any
}

function getIcon(type: NotificationEventType) {
  switch (type) {
    case 'SESSION_JOINED':   return <Bell size={16} />
    case 'JOIN_REQUESTED':   return <UserPlus size={16} />
    case 'SESSION_DELETED':  return <Trash2 size={16} />
    case 'CHAPTER_UPDATED':  return <BookOpen size={16} />
    case 'COMMENT_CREATED':  return <MessageCircle size={16} />
    case 'COMMENT_LIKED':    return <Heart size={16} />
    default:                  return <Bell size={16} />
  }
}

function getIconColor(type: NotificationEventType): string {
  switch (type) {
    case 'SESSION_JOINED':   return 'var(--electric-blue)'
    case 'JOIN_REQUESTED':   return '#a78bfa'
    case 'SESSION_DELETED':  return 'var(--danger)'
    case 'CHAPTER_UPDATED':  return '#4ade80'
    case 'COMMENT_CREATED':  return '#fbbf24'
    case 'COMMENT_LIKED':    return '#f472b6'
    default:                  return 'var(--text-secondary)'
  }
}

export function NotificationItem({ notification, onRead, onNavigate, getLabel, tNotifications }: NotificationItemProps) {
  const navigate = useNavigate()
  const { id, type, session_id, metadata, is_read, created_at } = notification
  const actor = metadata.actorUsername ?? tNotifications.someone
  const session = metadata.sessionTitle ?? tNotifications.aSession
  const label = getLabel(type, actor, session)
  const iconColor = getIconColor(type)

  const handleClick = () => {
    if (!is_read) onRead(id)
    if (session_id) {
      navigate(`/session/${session_id}`)
      onNavigate?.()
    }
  }

  return (
    <li
      className={`notif-item${!is_read ? ' notif-item-unread' : ''}${session_id ? ' notif-item-clickable' : ''}`}
      onClick={session_id ? handleClick : undefined}
      role={session_id ? 'button' : undefined}
      tabIndex={session_id ? 0 : undefined}
      onKeyDown={(e) => {
        if (session_id && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label={!is_read ? tNotifications.markAsRead(label) : label}
    >
      <span className="notif-item-icon" style={{ color: iconColor }}>
        {getIcon(type)}
      </span>
      <span className="notif-item-body">
        <span className="notif-item-text">{label}</span>
        <span className="notif-item-time">{formatTimeAgo(new Date(created_at))}</span>
      </span>
      {!is_read && <span className="notif-item-dot" aria-hidden="true" />}
    </li>
  )
}
