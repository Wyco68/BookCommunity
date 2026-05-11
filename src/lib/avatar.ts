import { PROFILE_AVATARS_BUCKET, getSignedMediaUrl } from './storage'

export const AVATAR_BUCKET = PROFILE_AVATARS_BUCKET
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export function getInitials(label: string | null | undefined): string {
  if (!label?.trim()) {
    return 'ME'
  }

  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || 'ME'
}

export function getAvatarExtension(file: File): string {
  const fromType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }

  if (fromType[file.type]) {
    return fromType[file.type]
  }

  const fromName = file.name.split('.').pop()?.toLowerCase()
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : 'jpg'
}

export async function resolveAvatarUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null
  if (isRemoteUrl(pathOrUrl)) return pathOrUrl
  return getSignedMediaUrl(pathOrUrl, PROFILE_AVATARS_BUCKET)
}

export async function resolveAvatarUrlMap(paths: string[]): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((path) => path && !isRemoteUrl(path))))

  if (uniquePaths.length === 0) return {}

  const entries = await Promise.all(
    uniquePaths.map(async (path) => {
      const url = await getSignedMediaUrl(path, PROFILE_AVATARS_BUCKET)
      return [path, url] as const
    }),
  )

  const result: Record<string, string> = {}
  for (const [path, url] of entries) {
    if (url !== null) result[path] = url
  }
  return result
}
