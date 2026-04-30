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
}

export function DashboardHeader({
  t,
  language,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onLanguageChange,
  onSignOut,
}: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Toggle button - visible when menu is closed */}
      {!mobileMenuOpen && (
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--charcoal)">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      )}

      {/* Mobile sidebar dropdown */}
      <nav className={`sidebar-mobile ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <span className="sidebar-brand">BookCom</span>
          <button
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <div className="sidebar-nav">
          <Link to={APP_PATHS.search} className="sidebar-link" onClick={() => setMobileMenuOpen(false)}>
            Home
          </Link>
          <Link to={APP_PATHS.sections} className="sidebar-link" onClick={() => setMobileMenuOpen(false)}>
            Sessions
          </Link>
          <Link to={APP_PATHS.categories} className="sidebar-link" onClick={() => setMobileMenuOpen(false)}>
            Categories
          </Link>
          <Link to={APP_PATHS.profileEdit} className="sidebar-link" onClick={() => setMobileMenuOpen(false)}>
            Profile
          </Link>
        </div>
        <div className="mobile-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="sm" />
            <span style={{ fontWeight: 460 }}>{myDisplayName}</span>
          </div>
          <button className="btn-danger" onClick={() => { setMobileMenuOpen(false); onSignOut() }} style={{ width: '100%' }}>
            {t.auth.signOut}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <Link to={APP_PATHS.search} className="sidebar-brand">
          BookCom
        </Link>

        <div className="sidebar-nav">
          <NavLink to={APP_PATHS.search} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Home
          </NavLink>
          <NavLink to={APP_PATHS.sections} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Sessions
          </NavLink>
          <NavLink to={APP_PATHS.categories} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            Categories
          </NavLink>
        </div>

        <div className="sidebar-cta">
          <Link to={APP_PATHS.profileEdit} className="header-identity-link">
            <div className="identity-row">
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="md" />
              <div>
                <p style={{ margin: 0, fontWeight: 540, fontSize: '0.95rem' }}>{myDisplayName}</p>
              </div>
            </div>
          </Link>
        </div>

        <div style={{ marginTop: 'auto', padding: '0.5rem' }}>
          <div className="auth-switch" role="tablist" aria-label={t.language.switchLabel} style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className={`auth-switch-option ${language === 'en' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onLanguageChange('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'my' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onLanguageChange('my')}
            >
              MY
            </button>
          </div>
          <button className="btn-danger" onClick={onSignOut} style={{ width: '100%' }}>
            {t.auth.signOut}
          </button>
        </div>
      </nav>
    </>
  )
}