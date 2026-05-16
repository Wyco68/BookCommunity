import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthLoadingView } from '../components/AuthView'
import type { Language } from '../i18n'
import { translations } from '../i18n'
import { APP_PATHS } from './paths'
import type { User } from '@supabase/supabase-js'

interface RequireAuthProps {
  user: User | null
  loading: boolean
  language: Language
}

export function RequireAuth({ user, loading, language }: RequireAuthProps) {
  const location = useLocation()
  const t = translations[language]

  if (loading) {
    return <AuthLoadingView message={t.auth.checkingSession} />
  }

  if (!user) {
    return <Navigate to={APP_PATHS.login} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
