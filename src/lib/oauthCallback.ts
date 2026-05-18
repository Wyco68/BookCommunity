import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function readOAuthErrorFromUrl(): string | null {
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

export function getOAuthCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('code')
}

/** Remove OAuth query/hash params so refresh does not re-process the callback. */
export function clearAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  url.searchParams.delete('state')
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    hashParams.delete('access_token')
    hashParams.delete('refresh_token')
    hashParams.delete('error')
    hashParams.delete('error_description')
    const nextHash = hashParams.toString()
    url.hash = nextHash ? `#${nextHash}` : ''
  }
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, document.title, next)
}

export type OAuthCallbackResult =
  | { ok: true; user: User }
  | { ok: false; error: string }

/**
 * Finish the browser OAuth redirect: exchange PKCE code, then fall back to stored session.
 */
export async function completeOAuthCallback(): Promise<OAuthCallbackResult> {
  const oauthError = readOAuthErrorFromUrl()
  if (oauthError) {
    return { ok: false, error: oauthError }
  }

  const code = getOAuthCodeFromUrl()
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return { ok: false, error: error.message }
    }
    const user = data.session?.user
    if (!user) {
      return { ok: false, error: 'Sign-in completed but no user session was returned.' }
    }
    clearAuthParamsFromUrl()
    return { ok: true, user }
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    return { ok: false, error: error.message }
  }
  const user = data.session?.user
  if (!user) {
    return { ok: false, error: 'No active session after sign-in.' }
  }
  return { ok: true, user }
}
