import { NavLink } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Avatar } from './Avatar'
import { APP_PATHS } from '../router/paths'

type Copy = (typeof translations)[Language]

export interface DashboardHeaderProps {
  t: Copy
  language: Language
  joinedSessionCount: number
  myAvatarImage: string | null
  myAvatarLabel: string
  myDisplayName: string
  onLanguageChange: (language: Language) => void
  onSignOut: () => void
}

export function DashboardHeader({
  t,
  language,
  joinedSessionCount,
  myAvatarImage,
  myAvatarLabel,
  myDisplayName,
  onLanguageChange,
  onSignOut,
}: DashboardHeaderProps) {
  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'nav-link-active' : ''}`

  return (
    <header className="card header-card">
      <div className="header-brand">
        <p className="eyebrow">{t.auth.welcomeBack}</p>
        <h1>BookCom</h1>
        <p className="subtle">{t.auth.joinedSessionsSummary(joinedSessionCount)}</p>
      </div>

      <div className="header-actions">
        <nav className="navbar-links" aria-label="Primary">
          <NavLink className={getNavClass} to={APP_PATHS.search}>
            Search
          </NavLink>
          <NavLink className={getNavClass} to={APP_PATHS.sections}>
            Sections
          </NavLink>
          <NavLink className={getNavClass} to={APP_PATHS.categories}>
            Categories
          </NavLink>
        </nav>

        <div className="auth-switch" role="tablist" aria-label={t.language.switchLabel}>
          <button
            type="button"
            className={`auth-switch-option ${language === 'en' ? 'auth-switch-option-active' : ''}`}
            onClick={() => onLanguageChange('en')}
          >
            {t.language.english}
          </button>
          <button
            type="button"
            className={`auth-switch-option ${language === 'my' ? 'auth-switch-option-active' : ''}`}
            onClick={() => onLanguageChange('my')}
          >
            {t.language.burmese}
          </button>
        </div>

        <NavLink className="header-identity-link" to={APP_PATHS.profileEdit}>
          <div className="header-identity">
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="md" />
            <div>
              <p className="subtle">{t.auth.signedInAs}</p>
              <strong>{myDisplayName}</strong>
            </div>
          </div>
        </NavLink>

        <button type="button" className="secondary" onClick={onSignOut}>
          {t.auth.signOut}
        </button>
      </div>
    </header>
  )
}
