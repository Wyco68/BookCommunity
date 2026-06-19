import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { APP_PATHS } from '../../router/paths'
import { Avatar } from '../Avatar'
import { NotificationBell } from '../Notifications/NotificationBell'
import type { SidebarProps } from './Sidebar'

export interface TopBarProps extends SidebarProps {
  onOpenSidebar: () => void
  userId?: string
}

export function TopBar({
  t,
  language,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onOpenSidebar,
  userId,
}: TopBarProps) {
  const [notifOpen, setNotifOpen] = useState(false)

  const getNotifLabel = (type: string, actor: string, session: string): string => {
    const n = t.notifications
    if (type === 'SESSION_JOINED') return n.SESSION_JOINED(actor, session)
    if (type === 'JOIN_REQUESTED') return n.JOIN_REQUESTED(actor, session)
    if (type === 'SESSION_DELETED') return n.SESSION_DELETED('', session)
    if (type === 'CHAPTER_UPDATED') return n.CHAPTER_UPDATED('', session)
    if (type === 'COMMENT_CREATED') return n.COMMENT_CREATED(actor, session)
    if (type === 'COMMENT_LIKED') return n.COMMENT_LIKED(actor, session)
    return session
  }

  return (
    <header className="saas-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button
          className="mobile-menu-toggle"
          onClick={onOpenSidebar}
          aria-label={t.nav.openMenu}
        >
          <Menu size={20} />
        </button>
        <Link to={APP_PATHS.home} className="top-nav-brand mobile-only-brand">
          BookCom
        </Link>
      </div>

      <div className="top-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
        <NotificationBell
          userId={userId ?? ''}
          language={language}
          open={notifOpen}
          onToggle={() => setNotifOpen((o) => !o)}
          onClose={() => setNotifOpen(false)}
          tNotifications={t.notifications}
          getLabel={getNotifLabel}
        />
        <Link to={APP_PATHS.account} className="header-identity-link top-nav-profile">
          <div className="identity-row">
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
            <p style={{ margin: 0, fontWeight: 540, fontSize: '0.9rem' }}>{myDisplayName}</p>
          </div>
        </Link>
      </div>

      <style>{`
        .saas-topbar .mobile-menu-toggle { display: none; }
        .saas-topbar .mobile-only-brand { display: none; }
        @media (max-width: 767px) {
          .saas-topbar .mobile-menu-toggle { display: inline-flex; }
          .saas-topbar .mobile-only-brand { display: block; }
          .saas-topbar .top-nav-profile { display: none; }
        }
      `}</style>
    </header>
  )
}
