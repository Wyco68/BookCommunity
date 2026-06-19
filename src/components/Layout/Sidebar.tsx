import { Link, NavLink } from 'react-router-dom'
import { APP_PATHS } from '../../router/paths'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { Avatar } from '../Avatar'
import { useMotion } from '../../hooks/useMotion'
import { useSlidingPill } from '../../hooks/useSlidingPill'

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
  const canAnimate = useMotion()
  const { containerRef: navRef, pillStyle: navPill } = useSlidingPill<HTMLDivElement>('.sidebar-link.active', [language])
  const { containerRef: langRef, pillStyle: langPill } = useSlidingPill<HTMLDivElement>('.auth-switch-option-active', [language])

  return (
    <>
      <aside className={`app-shell-sidebar saas-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <Link to={APP_PATHS.home} className="top-nav-brand" onClick={onClose}>
            BookCom
          </Link>
          <button className="sidebar-close-btn" onClick={onClose} aria-label={t.nav.closeMenu}>
            ✕
          </button>
        </div>

        <div className={`sidebar-nav ${canAnimate ? 'animated-pill-container' : ''}`} style={{ flex: 1, paddingTop: 'var(--space-5)', position: 'relative' }} ref={navRef}>
          {canAnimate && <div className="animated-pill" style={navPill} />}
          <NavLink to={APP_PATHS.home} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            {t.nav.home}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
              <span style={{ fontWeight: 460 }}>{myDisplayName}</span>
            </div>
          </Link>
          <div className={`auth-switch ${canAnimate ? 'animated-pill-container' : ''}`} role="tablist" aria-label={t.language.switchLabel} ref={langRef} style={{ position: 'relative' }}>
            {canAnimate && <div className="animated-pill" style={{ ...langPill, borderRadius: 'var(--radius-xs)' }} />}
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
