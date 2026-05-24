import { Link } from 'react-router-dom'
import { APP_PATHS } from '../../router/paths'
import { Avatar } from '../Avatar'
import type { SidebarProps } from './Sidebar'

export interface TopBarProps extends SidebarProps {
  onOpenSidebar: () => void
}

export function TopBar({
  t,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onOpenSidebar,
}: TopBarProps) {
  return (
    <header className="saas-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="mobile-menu-toggle"
          onClick={onOpenSidebar}
          aria-label={t.nav.openMenu}
          style={{ display: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </button>
        <Link to={APP_PATHS.home} className="top-nav-brand" style={{ display: 'none' }}>
          BookCom
        </Link>
      </div>

      <div className="top-nav-actions" style={{ display: 'flex', marginLeft: 'auto' }}>
        <Link to={APP_PATHS.profileEdit} className="header-identity-link">
          <div className="identity-row">
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
            <p style={{ margin: 0, fontWeight: 540, fontSize: '0.9rem' }}>{myDisplayName}</p>
          </div>
        </Link>
      </div>
      
      <style>{`
        @media (max-width: 768px) {
          .saas-topbar .mobile-menu-toggle { display: inline-flex !important; }
          .saas-topbar .top-nav-brand { display: block !important; }
          .saas-topbar .top-nav-actions { display: none !important; }
        }
      `}</style>
    </header>
  )
}
