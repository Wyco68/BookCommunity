import { useCallback, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { translations, type Language } from '../i18n'
import { APP_PATHS } from '../router/paths'
import { isAuthRateLimited, mapAuthError } from '../lib/profileErrors'
import { validateEmail, validatePassword } from '../lib/validation'

const RATE_LIMIT_COOLDOWN_MS = 8000

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
  signUp: () => Promise<'ok' | 'confirm_email' | 'error'>
  submitBlockedUntil: number | null
  signOut: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  googleBusy: boolean
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguageRaw] = useState<Language>(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'de' || saved === 'my') return saved
    return 'en'
  })

  const setLanguage = useCallback((lang: Language) => {
    setLanguageRaw(lang)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [submitBlockedUntil, setSubmitBlockedUntil] = useState<number | null>(null)
  const signUpInFlightRef = useRef(false)

  const signIn = useCallback(async () => {
    if (submitBlockedUntil !== null && Date.now() < submitBlockedUntil) {
      return
    }
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
  }, [email, password, submitBlockedUntil])

  const signUp = useCallback(async (): Promise<'ok' | 'confirm_email' | 'error'> => {
    const t = translations[language]

    if (!email.trim() || !password.trim()) {
      setError(t.auth.enterEmailPassword)
      return 'error'
    }

    const emailCheck = validateEmail(email)
    if (!emailCheck.valid) {
      setError(emailCheck.error ?? t.auth.enterEmailPassword)
      return 'error'
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      setError(t.auth.passwordRequirements)
      return 'error'
    }

    if (submitBlockedUntil !== null && Date.now() < submitBlockedUntil) {
      return 'error'
    }
    if (signUpInFlightRef.current) {
      return 'error'
    }

    signUpInFlightRef.current = true
    setBusy(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    })

    signUpInFlightRef.current = false
    setBusy(false)

    if (authError) {
      if (isAuthRateLimited(authError.message, authError.status)) {
        setSubmitBlockedUntil(Date.now() + RATE_LIMIT_COOLDOWN_MS)
        setError('Too many sign-up attempts. Please wait a few seconds and try again.')
      } else {
        const mapped = mapAuthError(authError)
        const lower = (authError.message ?? '').toLowerCase()
        if (
          mapped?.includes('email already exists')
          || lower.includes('already registered')
          || lower.includes('already been registered')
        ) {
          setError(t.auth.emailAlreadyRegistered)
        } else {
          setError(mapped ?? authError.message)
        }
      }
      return 'error'
    }

    if (data.session) {
      return 'ok'
    }

    setError(t.auth.accountCreated)
    return 'confirm_email'
  }, [email, password, language, submitBlockedUntil])

  const signOut = useCallback(async () => {
    setError(null)
    await supabase.auth.signOut()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setGoogleBusy(true)
    setError(null)
    const redirectTo = `${window.location.origin}${APP_PATHS.authCallback}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (oauthError) {
      setError(oauthError.message)
      setGoogleBusy(false)
    }
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
    submitBlockedUntil,
    signOut,
    signInWithGoogle,
    googleBusy,
  }
}