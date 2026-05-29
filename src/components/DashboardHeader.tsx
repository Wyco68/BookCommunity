import { Link, NavLink } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Avatar } from './Avatar'
import { APP_PATHS } from '../router/paths'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { NotificationBell } from './Notifications/NotificationBell'
import { useMotion } from '../hooks/useMotion'
import { useSlidingPill } from '../hooks/useSlidingPill'

type Copy = (typeof translations)[Language]

export interface DashboardHeaderProps {
  t: Copy
  language: Language
  myAvatarImage: string | null
  myAvatarLabel: string
  myDisplayName: string
  onLanguageChange: (language: Language) => void
  onSignOut: () => void
  onCreateClick?: () => void
  userId?: string
}

export function DashboardHeader({
  t,
  language,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onLanguageChange,
  onCreateClick,
  userId,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const closeMobileMenu = () => setMobileMenuOpen(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const canAnimate = useMotion()
  const { containerRef: navRef, pillStyle: navPill } = useSlidingPill<HTMLDivElement>('.sidebar-link.active', [language])
  const { containerRef: langRef, pillStyle: langPill } = useSlidingPill<HTMLDivElement>('.auth-switch-option-active', [language])

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
    <>
      <header className="top-nav">
        <div className="top-nav-inner max-w-5xl mx-auto px-4 w-full flex justify-between items-center">
          <div className="flex-1 flex justify-start">
            <Link to={APP_PATHS.home} className="top-nav-brand">
              BookCom
            </Link>
          </div>

          <nav className={`top-nav-links flex-1 justify-center ${canAnimate ? 'animated-pill-container' : ''}`} aria-label="Main navigation" ref={navRef}>
            {canAnimate && <div className="animated-pill" style={navPill} />}
            <NavLink to={APP_PATHS.home} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              {t.nav.home}
            </NavLink>
            <NavLink to={APP_PATHS.search} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              {t.nav.search}
            </NavLink>
            <NavLink to={APP_PATHS.categories} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              {t.nav.categories}
            </NavLink>
          </nav>

          <div className="top-nav-actions flex-1 justify-end">
            <NotificationBell
              userId={userId ?? ''}
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
            <div className={`auth-switch top-nav-language ${canAnimate ? 'animated-pill-container' : ''}`} role="tablist" aria-label={t.language.switchLabel} ref={langRef}>
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
            <button
              className="mobile-menu-toggle lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <nav className={`top-nav-mobile-menu ${mobileMenuOpen ? 'open' : ''}`} aria-label="Mobile navigation">
        <div className="mobile-sidebar-header">
          <span className="top-nav-brand">{t.nav.menu}</span>
          <button
            className="sidebar-close-btn"
            onClick={closeMobileMenu}
            aria-label={t.nav.closeMenu}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-nav">
          <Link to={APP_PATHS.home} className="sidebar-link" onClick={closeMobileMenu}>
            {t.nav.home}
          </Link>
          <Link to={APP_PATHS.search} className="sidebar-link" onClick={closeMobileMenu}>
            {t.nav.search}
          </Link>
          <Link to={APP_PATHS.categories} className="sidebar-link" onClick={closeMobileMenu}>
            {t.nav.categories}
          </Link>
          <Link to={APP_PATHS.account} className="sidebar-link" onClick={closeMobileMenu}>
            {t.nav.profile}
          </Link>
          {onCreateClick ? (
            <button
              type="button"
              className="sidebar-create-btn"
              onClick={() => {
                closeMobileMenu()
                onCreateClick()
              }}
            >
              {t.nav.createSession}
            </button>
          ) : null}
        </div>
        <div className="mobile-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
            <span style={{ fontWeight: 460 }}>{myDisplayName}</span>
          </div>
          <div className="auth-switch" role="tablist" aria-label={t.language.switchLabel} style={{ position: 'relative', zIndex: 0 }}>
              {canAnimate && (
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  bottom: '3px',
                  left: '3px',
                  width: 'calc(33.33% - 2px)',
                  backgroundColor: 'var(--electric-blue)',
                  borderRadius: 'var(--radius-xs)',
                  transform: `translateX(${['en', 'de', 'my'].indexOf(language) * 100}%)`,
                  transition: 'transform var(--timing-normal) var(--easing-spring)',
                  zIndex: -1
                }} />
              )}
            <button
              type="button"
              className={`auth-switch-option ${language === 'en' ? (canAnimate ? '' : 'auth-switch-option-active') : ''}`}
              style={canAnimate && language === 'en' ? { color: '#fff' } : {}}
              onClick={() => onLanguageChange('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'de' ? (canAnimate ? '' : 'auth-switch-option-active') : ''}`}
              style={canAnimate && language === 'de' ? { color: '#fff' } : {}}
              onClick={() => onLanguageChange('de')}
            >
              DE
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'my' ? (canAnimate ? '' : 'auth-switch-option-active') : ''}`}
              style={canAnimate && language === 'my' ? { color: '#fff' } : {}}
              onClick={() => onLanguageChange('my')}
            >
              MY
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen ? <div className="mobile-overlay" onClick={closeMobileMenu} /> : null}
    </>
  )
}