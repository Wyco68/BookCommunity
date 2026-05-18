import { lazy, Suspense, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { translations } from './i18n'
import { useAuth } from './hooks/useAuth'
import { RequireAuth } from './router/RequireAuth'
import { APP_PATHS } from './router/paths'
import { LoginPage } from './pages/LoginPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { AuthLoadingView } from './components/AuthView'
import './App.css'

const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'))

function App() {
  const auth = useAuth()
  const location = useLocation()
  const t = translations[auth.language]

  const { setError: authSetError, setUser: authSetUser, setLoading: authSetLoading } = auth
  const {
    mode: authMode,
    signIn: authSignIn,
    signUp: authSignUp,
    signInWithGoogle,
    googleBusy,
    setMode: authSetMode,
    setEmail: authSetEmail,
    setPassword: authSetPassword,
  } = auth

  const handleOAuthResolved = useCallback(
    (user: User | null) => {
      authSetUser(user)
      authSetLoading(false)
    },
    [authSetUser, authSetLoading],
  )

  useEffect(() => {
    let alive = true
    const isOAuthCallback = location.pathname === APP_PATHS.authCallback

    if (isOAuthCallback) {
      authSetLoading(true)
    } else {
      async function bootstrap() {
        const { data, error } = await supabase.auth.getSession()
        if (!alive) return
        if (error) authSetError(error.message)
        authSetUser(data.session?.user ?? null)
        authSetLoading(false)
      }

      bootstrap().catch((error: unknown) => {
        authSetError(error instanceof Error ? error.message : 'Unexpected authentication error')
        authSetLoading(false)
      })
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (location.pathname === APP_PATHS.authCallback) return
      authSetUser(session?.user ?? null)
      authSetLoading(false)
    })

    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [location.pathname, authSetError, authSetUser, authSetLoading])

  const handleAuthSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (authMode === 'sign-in') {
      void authSignIn()
    } else {
      void authSignUp()
    }
  }, [authMode, authSignIn, authSignUp])

  const handleAuthModeChange = useCallback(
    (mode: 'sign-in' | 'sign-up') => {
      authSetMode(mode)
      authSetEmail('')
      authSetPassword('')
    },
    [authSetMode, authSetEmail, authSetPassword],
  )

  const handleGoogleSignIn = useCallback(() => {
    void signInWithGoogle()
  }, [signInWithGoogle])

  return (
    <Routes>
      <Route
        path={APP_PATHS.authCallback}
        element={
          <AuthCallbackPage language={auth.language} onAuthResolved={handleOAuthResolved} />
        }
      />
      <Route
        path={APP_PATHS.login}
        element={
          <LoginPage
            language={auth.language}
            user={auth.user}
            loading={auth.loading}
            authMode={authMode}
            authEmail={auth.email}
            authPassword={auth.password}
            authError={auth.error}
            authBusy={auth.busy}
            googleBusy={googleBusy}
            onSubmit={handleAuthSubmit}
            onAuthModeChange={handleAuthModeChange}
            onAuthEmailChange={authSetEmail}
            onAuthPasswordChange={authSetPassword}
            onLanguageChange={auth.setLanguage}
            onGoogleSignIn={handleGoogleSignIn}
          />
        }
      />
      <Route element={<RequireAuth user={auth.user} loading={auth.loading} language={auth.language} />}>
        <Route
          path="*"
          element={
            <Suspense fallback={<AuthLoadingView message={t.common.loading} />}>
              {auth.user ? (
                <AuthenticatedApp
                  user={auth.user}
                  language={auth.language}
                  setLanguage={auth.setLanguage}
                />
              ) : null}
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
