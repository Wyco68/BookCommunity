import { Link, NavLink } from 'react-router-dom'
import { APP_PATHS } from '../../router/paths'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { Avatar } from '../Avatar'

type Copy = (typeof translations)[Language]

export interface SidebarProps {
  t: Copy
  language: Language
  myAvatarImage: string | null
  myAvatarLabel: string
  myDisplayName: string
  onLanguageChange: (language: Language) => void
  onSignOut: () => void
  onCreateClick?: () => void
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({
  t,
  language,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onLanguageChange,
  onCreateClick,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      <aside className={`saas-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <Link to={APP_PATHS.home} className="top-nav-brand" onClick={onClose}>
            BookCom
          </Link>
          <button className="sidebar-close-btn" onClick={onClose} aria-label={t.nav.closeMenu}>
            ✕
          </button>
        </div>
        
        <div className="sidebar-nav" style={{ flex: 1, paddingTop: '1.5rem' }}>
          <NavLink to={APP_PATHS.home} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            {t.nav.home}
          </NavLink>
          <NavLink to={APP_PATHS.search} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            {t.nav.search}
          </NavLink>
          <NavLink to={APP_PATHS.categories} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            {t.nav.categories}
          </NavLink>
          
          {onCreateClick ? (
            <button
              type="button"
              className="sidebar-create-btn"
              onClick={() => {
                onClose?.()
                onCreateClick()
              }}
            >
              {t.nav.createSession}
            </button>
          ) : null}
        </div>

        <div className="mobile-sidebar-footer">
          <Link to={APP_PATHS.account} className="header-identity-link" onClick={onClose}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
              <span style={{ fontWeight: 460 }}>{myDisplayName}</span>
            </div>
          </Link>
          <div className="auth-switch" role="tablist" aria-label={t.language.switchLabel}>
            <button
              type="button"
              className={`auth-switch-option ${language === 'en' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onLanguageChange('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'de' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onLanguageChange('de')}
            >
              DE
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'my' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onLanguageChange('my')}
            >
              MY
            </button>
          </div>
        </div>
      </aside>
      {isOpen ? <div className="mobile-overlay" onClick={onClose} /> : null}
    </>
  )
}
