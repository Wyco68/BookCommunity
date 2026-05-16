import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthLoadingView } from '../components/AuthView'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { APP_PATHS } from '../router/paths'

function readOAuthErrorFromUrl(): string | null {
  const search = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const code = search.get('error') ?? hashParams.get('error')
  if (!code) return null
  const description = search.get('error_description') ?? hashParams.get('error_description')
  if (code === 'access_denied') {
    return description ?? 'Sign-in was cancelled.'
  }
  return description ?? code
}

interface AuthCallbackPageProps {
  language: Language
}

export function AuthCallbackPage({ language }: AuthCallbackPageProps) {
  const navigate = useNavigate()
  const t = translations[language]
  const finished = useRef(false)

  useEffect(() => {
    const oauthError = readOAuthErrorFromUrl()
    if (oauthError) {
      navigate(APP_PATHS.login, { replace: true, state: { oauthError } })
      return
    }

    let cancelled = false

    const finish = (path: typeof APP_PATHS.login | typeof APP_PATHS.dashboard) => {
      if (finished.current || cancelled) return
      finished.current = true
      navigate(path, { replace: true })
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user
        && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        finish(APP_PATHS.dashboard)
      }
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled || finished.current) return
      if (!error && data.session?.user) {
        finish(APP_PATHS.dashboard)
      }
    })

    const timeoutId = window.setTimeout(() => {
      if (cancelled || finished.current) return
      void supabase.auth.getSession().then(({ data }) => {
        finish(data.session?.user ? APP_PATHS.dashboard : APP_PATHS.login)
      })
    }, 2500)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  return <AuthLoadingView message={t.auth.completingOAuth} />
}
