import type { FormEvent } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { AuthLoadingView, AuthView } from '../components/AuthView'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { APP_PATHS } from '../router/paths'

type Copy = (typeof translations)[Language]
type AuthMode = 'sign-in' | 'sign-up'

interface LoginPageProps {
  language: Language
  user: User | null
  loading: boolean
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

export function LoginPage({
  language,
  user,
  loading,
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
}: LoginPageProps) {
  const t: Copy = translations[language]
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const oauthError = (location.state as { oauthError?: string } | null)?.oauthError

  useEffect(() => {
    if (!loading && user) {
      const target = from && from !== APP_PATHS.login && from !== APP_PATHS.authCallback
        ? from
        : APP_PATHS.dashboard
      navigate(target, { replace: true })
    }
  }, [from, loading, navigate, user])

  if (loading) {
    return <AuthLoadingView message={t.auth.checkingSession} />
  }

  if (user) {
    return null
  }

  const combinedError = oauthError ?? authError

  return (
    <AuthView
      t={t}
      language={language}
      authMode={authMode}
      authEmail={authEmail}
      authPassword={authPassword}
      authError={combinedError}
      authBusy={authBusy}
      googleBusy={googleBusy}
      onSubmit={onSubmit}
      onAuthModeChange={onAuthModeChange}
      onAuthEmailChange={onAuthEmailChange}
      onAuthPasswordChange={onAuthPasswordChange}
      onLanguageChange={onLanguageChange}
      onGoogleSignIn={onGoogleSignIn}
    />
  )
}
