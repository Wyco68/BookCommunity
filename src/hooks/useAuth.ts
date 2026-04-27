import { useCallback, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Language } from '../i18n'

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

export interface UseAuthReturn {
  user: User | null
  loading: boolean
  language: Language
  setLanguage: (lang: Language) => void
  error: string | null
  busy: boolean
  email: string
  password: string
  mode: 'sign-in' | 'sign-up'
  setEmail: (email: string) => void
  setPassword: (password: string) => void
  setMode: (mode: 'sign-in' | 'sign-up') => void
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  signIn: () => Promise<void>
  signUp: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return saved === 'my' ? 'my' : 'en'
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')

  const signIn = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password')
      return
    }
    setBusy(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    })
    if (authError) {
      setError(authError.message)
      setBusy(false)
      return
    }
    setBusy(false)
  }, [email, password])

  const signUp = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password')
      return
    }
    setBusy(true)
    setError(null)
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    })
    if (authError) {
      setError(authError.message)
      setBusy(false)
      return
    }
    setBusy(false)
  }, [email, password])

  const signOut = useCallback(async () => {
    setError(null)
    await supabase.auth.signOut()
  }, [])

  return {
    user,
    loading,
    language,
    setLanguage,
    error,
    busy,
    email,
    password,
    mode,
    setEmail,
    setPassword,
    setMode,
    setUser,
    setLoading,
    setError,
    signIn,
    signUp,
    signOut,
  }
}