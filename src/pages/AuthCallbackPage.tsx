import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { completeOAuthCallback } from '../lib/oauthCallback'
import { AuthLoadingView } from '../components/AuthView'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import { APP_PATHS } from '../router/paths'

interface AuthCallbackPageProps {
  language: Language
  onAuthResolved: (user: User | null) => void
}

export function AuthCallbackPage({ language, onAuthResolved }: AuthCallbackPageProps) {
  const navigate = useNavigate()
  const t = translations[language]
  const finished = useRef(false)

  useEffect(() => {
    let cancelled = false

    const finish = (path: typeof APP_PATHS.login | typeof APP_PATHS.dashboard, user: User | null) => {
      if (finished.current || cancelled) return
      finished.current = true
      onAuthResolved(user)
      navigate(path, {
        replace: true,
        state: user ? undefined : { oauthError: 'Sign-in could not be completed. Please try again.' },
      })
    }

    void (async () => {
      const result = await completeOAuthCallback()
      if (cancelled || finished.current) return

      if (result.ok) {
        finish(APP_PATHS.dashboard, result.user)
        return
      }

      navigate(APP_PATHS.login, { replace: true, state: { oauthError: result.error } })
      onAuthResolved(null)
      finished.current = true
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session?.user
        && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        finish(APP_PATHS.dashboard, session.user)
      }
    })

    const timeoutId = window.setTimeout(() => {
      if (cancelled || finished.current) return
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          finish(APP_PATHS.dashboard, data.session.user)
        } else {
          finish(APP_PATHS.login, null)
        }
      })
    }, 5000)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      authListener.subscription.unsubscribe()
    }
  }, [navigate, onAuthResolved])

  return <AuthLoadingView message={t.auth.completingOAuth} />
}
