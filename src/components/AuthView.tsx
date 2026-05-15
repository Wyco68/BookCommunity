import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Spinner } from './Spinner'

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
  googleBusy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onAuthModeChange: (mode: AuthMode) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLanguageChange: (language: Language) => void
  onGoogleSignIn: () => void
}

export function AuthView({
  t,
  language,
  authMode,
  authEmail,
  authPassword,
  authError,
  authBusy,
  googleBusy,
  onSubmit,
  onAuthModeChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLanguageChange,
  onGoogleSignIn,
}: AuthViewProps) {
  const disableEmailAuth = authBusy || googleBusy

  return (
    <main className="shell">
      <section className="card auth-card">
        <div>
          <p className="eyebrow">BookCom</p>
          <h1>{t.auth.welcome}</h1>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <div className="auth-switch" role="tablist" aria-label={t.auth.modeAriaLabel}>
            <button
              type="button"
              className={`auth-switch-option ${authMode === 'sign-in' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onAuthModeChange('sign-in')}
              disabled={disableEmailAuth}
            >
              {t.auth.signIn}
            </button>
            <button
              type="button"
              className={`auth-switch-option ${authMode === 'sign-up' ? 'auth-switch-option-active' : ''}`}
              onClick={() => onAuthModeChange('sign-up')}
              disabled={disableEmailAuth}
            >
              {t.auth.signUp}
            </button>
          </div>

          <input
            type="email"
            value={authEmail}
            onChange={(event) => onAuthEmailChange(event.target.value)}
            placeholder={t.auth.emailPlaceholder}
            autoComplete="email"
            aria-label={t.auth.email}
            disabled={disableEmailAuth}
          />

          <input
            type="password"
            value={authPassword}
            onChange={(event) => onAuthPasswordChange(event.target.value)}
            placeholder={t.auth.passwordPlaceholder}
            autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
            aria-label={t.auth.password}
            disabled={disableEmailAuth}
          />

          {authError ? <p className="error">{authError}</p> : null}

          <button type="submit" className="primary" disabled={disableEmailAuth}>
            {authBusy ? t.common.pleaseWait : authMode === 'sign-in' ? t.auth.signIn : t.auth.createAccount}
          </button>
        </form>

        <div className="stack">
          <p className="auth-oauth-divider" role="presentation">
            <span>{t.auth.orDivider}</span>
          </p>
          <button
            type="button"
            className="secondary auth-google-btn"
            onClick={() => {
              void onGoogleSignIn()
            }}
            disabled={disableEmailAuth}
          >
            {googleBusy ? t.auth.redirectingGoogle : t.auth.continueWithGoogle}
          </button>
        </div>

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
            className={`auth-switch-option auth-switch-option-mini ${language === 'de' ? 'auth-switch-option-active' : ''}`}
            onClick={() => onLanguageChange('de')}
          >
            DE
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
      <section className="centered">
        <h1 style={{ marginBottom: 'var(--space-4)' }}>BookCom</h1>
        <Spinner size="md" showLabel label={message} />
      </section>
    </main>
  )
}
