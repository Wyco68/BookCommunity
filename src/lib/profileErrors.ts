import type { AuthError, PostgrestError } from '@supabase/supabase-js'

export function mapAuthError(error: AuthError | null): string | null {
  if (!error) return null

  const message = error.message ?? ''
  const lower = message.toLowerCase()

  if (
    lower.includes('already registered')
    || lower.includes('already been registered')
    || lower.includes('user already exists')
    || lower.includes('email address is already')
    || lower.includes('duplicate')
  ) {
    return 'An account with this email already exists.'
  }

  if (lower.includes('password') && (lower.includes('weak') || lower.includes('strength'))) {
    return 'Password does not meet security requirements.'
  }

  return message
}

export function mapProfileUpdateError(error: PostgrestError | null): string | null {
  if (!error) return null

  const message = error.message ?? ''
  const lower = message.toLowerCase()
  const code = error.code ?? ''

  if (code === '23505' || lower.includes('unique') || lower.includes('duplicate')) {
    return 'That username is already taken.'
  }

  if (lower.includes('invalid username')) {
    return 'Username must be at least 3 characters, use only lowercase letters, numbers, underscore or hyphen, and no spaces.'
  }

  if (lower.includes('username is required')) {
    return 'Username is required.'
  }

  if (lower.includes('once every 30 days')) {
    return 'You can change your username once every 30 days.'
  }

  if (lower.includes('invalid avatar path')) {
    return 'Avatar path is invalid. Please upload your avatar again.'
  }

  return message
}

export function mapAvatarUpdateError(message: string | null): string | null {
  if (!message) return null
  const lower = message.toLowerCase()
  if (lower.includes('invalid avatar path')) {
    return 'Avatar path is invalid. Please upload your avatar again.'
  }
  return message
}

export function isAuthRateLimited(message: string, status?: number): boolean {
  if (status === 429) return true
  return /rate.?limit|too many requests/i.test(message)
}
