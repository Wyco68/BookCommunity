interface RateLimitConfig {
  maxActions: number
  windowMs: number
  cooldownMs?: number
}

const actionTimestamps = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const timestamps = actionTimestamps.get(key) ?? []

  const validTimestamps = timestamps.filter((ts) => now - ts < config.windowMs)

  if (config.cooldownMs && validTimestamps.length > 0) {
    const lastAction = validTimestamps[validTimestamps.length - 1]
    const timeSinceLast = now - lastAction
    if (timeSinceLast < config.cooldownMs) {
      return { allowed: false, retryAfterMs: config.cooldownMs - timeSinceLast }
    }
  }

  if (validTimestamps.length >= config.maxActions) {
    const oldestInWindow = validTimestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) }
  }

  return { allowed: true, retryAfterMs: 0 }
}

export function recordAction(key: string, windowMs: number): void {
  const now = Date.now()
  const timestamps = actionTimestamps.get(key) ?? []
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs)
  validTimestamps.push(now)
  actionTimestamps.set(key, validTimestamps)
}

export const COMMENT_RATE_LIMIT: RateLimitConfig = {
  maxActions: 10,
  windowMs: 60 * 1000,
  cooldownMs: 3000,
}

export const MEDIA_UPLOAD_RATE_LIMIT: RateLimitConfig = {
  maxActions: 5,
  windowMs: 60 * 1000,
  cooldownMs: 5000,
}

export const SESSION_CREATE_RATE_LIMIT: RateLimitConfig = {
  maxActions: 3,
  windowMs: 60 * 1000,
}

export const CATEGORY_CREATE_RATE_LIMIT: RateLimitConfig = {
  maxActions: 5,
  windowMs: 5 * 60 * 1000,
}

export const JOIN_REQUEST_RATE_LIMIT: RateLimitConfig = {
  maxActions: 10,
  windowMs: 60 * 1000,
}
