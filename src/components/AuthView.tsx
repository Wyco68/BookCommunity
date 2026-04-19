import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'

type Copy = (typeof translations)[Language]

type AuthMode = 'sign-in' | 'sign-up'

interface AuthViewProps {
  t: Copy
  language: Language
  authMode: AuthMode
  authEmail: string
  authPassword: string
  authError: string | null
  authBusy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onAuthModeChange: (mode: AuthMode) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLanguageChange: (language: Language) => void
}

export function AuthView({
  t,
  language,
  authMode,
  authEmail,
  authPassword,
  authError,
  authBusy,
  onSubmit,
  onAuthModeChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLanguageChange,
}: AuthViewProps) {
  return (
    <main className="shell">
      <section className="card auth-card">
        <div>
          <p className="eyebrow">BookCom</p>
          <h1>{t.auth.welcome}</h1>
          <p className="subtle">{t.auth.subtitle}</p>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <div className="auth-switch" role="tablist" aria-label={t.auth.modeAriaLabel}>
            <button
              type="button"
              className={`auth-switch-option ${authMode === 'sign-in' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onAuthModeChange('sign-in')}
            >
              {t.auth.signIn}
            </button>
            <button
              type="button"
              className={`auth-switch-option ${authMode === 'sign-up' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onAuthModeChange('sign-up')}
            >
              {t.auth.signUp}
            </button>
          </div>

          <label className="field">
            <span>{t.auth.email}</span>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => onAuthEmailChange(event.target.value)}
              placeholder={t.auth.emailPlaceholder}
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>{t.auth.password}</span>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => onAuthPasswordChange(event.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
            />
          </label>

          {authError ? <p className="error">{authError}</p> : null}

          <button type="submit" className="primary" disabled={authBusy}>
            {authBusy ? t.common.pleaseWait : authMode === 'sign-in' ? t.auth.signIn : t.auth.createAccount}
          </button>
        </form>

        <div className="auth-switch auth-switch-corner" role="tablist" aria-label={t.language.switchLabel}>
          <button
            type="button"
            className={`auth-switch-option auth-switch-option-mini ${language === 'en' ? 'auth-switch-option-active' : ''}`}
            onClick={() => onLanguageChange('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`auth-switch-option auth-switch-option-mini ${language === 'my' ? 'auth-switch-option-active' : ''}`}
            onClick={() => onLanguageChange('my')}
          >
            MY
          </button>
        </div>
      </section>
    </main>
  )
}

interface AuthLoadingViewProps {
  message: string
}

export function AuthLoadingView({ message }: AuthLoadingViewProps) {
  return (
    <main className="shell">
      <section className="card centered">
        <h1>BookCom</h1>
        <p>{message}</p>
      </section>
    </main>
  )
}
