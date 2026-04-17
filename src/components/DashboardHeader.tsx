import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Avatar } from './Avatar'

type Copy = (typeof translations)[Language]

interface DashboardHeaderProps {
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
  return (
    <header className="card header-card">
      <div>
        <p className="eyebrow">{t.auth.welcomeBack}</p>
        <h1>Books and Friends</h1>
        <p className="subtle">{t.auth.joinedSessionsSummary(joinedSessionCount)}</p>
      </div>

      <div className="header-actions">
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

        <div className="header-identity">
          <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="md" />
          <div>
            <p className="subtle">{t.auth.signedInAs}</p>
            <strong>{myDisplayName}</strong>
          </div>
        </div>

        <button type="button" className="secondary" onClick={onSignOut}>
          {t.auth.signOut}
        </button>
      </div>
    </header>
  )
}
