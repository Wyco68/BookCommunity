import { Link, NavLink } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Avatar } from './Avatar'
import { APP_PATHS } from '../router/paths'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

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
            <Link to={APP_PATHS.account} className="header-identity-link top-nav-profile">
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
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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