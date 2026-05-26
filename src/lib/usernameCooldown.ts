export const USERNAME_CHANGE_COOLDOWN_DAYS = 30

const COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

export interface UsernameChangeStatus {
  canChange: boolean
  nextChangeAt: Date | null
}

export function getUsernameChangeStatus(
  usernameUpdatedAt: string | null | undefined,
  nowMs = Date.now(),
): UsernameChangeStatus {
  if (!usernameUpdatedAt) {
    return { canChange: true, nextChangeAt: null }
  }

  const lastChangeMs = new Date(usernameUpdatedAt).getTime()
  if (Number.isNaN(lastChangeMs)) {
    return { canChange: true, nextChangeAt: null }
  }

  const nextChangeMs = lastChangeMs + COOLDOWN_MS
  if (nowMs >= nextChangeMs) {
    return { canChange: true, nextChangeAt: null }
  }

  return { canChange: false, nextChangeAt: new Date(nextChangeMs) }
}
