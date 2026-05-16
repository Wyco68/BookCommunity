import { Link, NavLink } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Avatar } from './Avatar'
import { APP_PATHS } from '../router/paths'
import { useState } from 'react'

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
}

export function DashboardHeader({
  t,
  language,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onLanguageChange,
  onCreateClick,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link to={APP_PATHS.home} className="top-nav-brand">
            BookCom
          </Link>

          <nav className="top-nav-links" aria-label="Main navigation">
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

          <div className="top-nav-actions">
            {onCreateClick ? (
              <button type="button" className="sidebar-create-btn top-nav-create-btn" onClick={onCreateClick}>
                {t.nav.createSession}
              </button>
            ) : null}
            <Link to={APP_PATHS.profileEdit} className="header-identity-link top-nav-profile">
              <div className="identity-row">
                <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
                <p style={{ margin: 0, fontWeight: 540, fontSize: '0.9rem' }}>{myDisplayName}</p>
              </div>
            </Link>
            <div className="auth-switch top-nav-language" role="tablist" aria-label={t.language.switchLabel}>
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

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={mobileMenuOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d={mobileMenuOpen ? 'M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.42 6.29 6.29-6.29 6.29 1.41 1.42 6.3-6.3 6.3 6.3 1.41-1.42-6.29-6.29 6.29-6.29z' : 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'} />
            </svg>
          </button>
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
            ✕
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
          <Link to={APP_PATHS.profileEdit} className="sidebar-link" onClick={closeMobileMenu}>
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
      </nav>

      {mobileMenuOpen ? <div className="mobile-overlay" onClick={closeMobileMenu} /> : null}
    </>
  )
}