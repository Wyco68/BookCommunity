import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { Spinner } from './Spinner'
import { useMotion } from '../hooks/useMotion'
import { useSlidingPill } from '../hooks/useSlidingPill'

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
  submitBlockedUntil: number | null
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
  submitBlockedUntil,
  googleBusy,
  onSubmit,
  onAuthModeChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLanguageChange,
  onGoogleSignIn,
}: AuthViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const canAnimate = useMotion()
  const { containerRef: tabRef, pillStyle: tabPill } = useSlidingPill<HTMLDivElement>('.auth-switch-option-active', [language])
  const { containerRef: langRef, pillStyle: langPill } = useSlidingPill<HTMLDivElement>('.auth-switch-option-active', [language])

  useEffect(() => {
    if (submitBlockedUntil !== null) {
      const timer = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(timer)
    }
  }, [submitBlockedUntil])

  const rateLimited =
    submitBlockedUntil !== null && now < submitBlockedUntil
  const disableEmailAuth = authBusy || googleBusy || rateLimited

  return (
    <main className={`shell ${canAnimate ? 'animate-fade-in' : ''}`}>
      <section className="card auth-card">
        <div>
          <p className="eyebrow">BookCom</p>
          <h1>{t.auth.welcome}</h1>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <div className={`auth-switch ${canAnimate ? 'animated-pill-container' : ''}`} role="tablist" aria-label={t.auth.modeAriaLabel} ref={tabRef}>
            {canAnimate && <div className="animated-pill" style={{ ...tabPill, borderRadius: 'var(--radius-xs)' }} />}
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

          {authMode === 'sign-up' ? (
            <p className="subtle" style={{ margin: 0, fontSize: '0.8125rem' }}>{t.auth.passwordRequirements}</p>
          ) : null}

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

        <div className={`auth-switch auth-switch-corner ${canAnimate ? 'animated-pill-container' : ''}`} role="tablist" aria-label={t.language.switchLabel} ref={langRef}>
          {canAnimate && <div className="animated-pill" style={{ ...langPill, borderRadius: 'var(--radius-xs)' }} />}
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
  const canAnimate = useMotion()
  return (
    <main className={`shell ${canAnimate ? 'animate-fade-in' : ''}`}>
      <section className="centered">
        <h1 style={{ marginBottom: 'var(--space-4)' }}>BookCom</h1>
        <Spinner size="md" showLabel label={message} />
      </section>
    </main>
  )
}
