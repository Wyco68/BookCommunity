import { supabase } from './supabase'

export const AVATAR_BUCKET = 'avatars'
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
  if (!pathOrUrl) {
    return null
  }

  if (isRemoteUrl(pathOrUrl)) {
    return pathOrUrl
  }

  const signedResult = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(pathOrUrl, 60 * 60)
  if (!signedResult.error && signedResult.data?.signedUrl) {
    return signedResult.data.signedUrl
  }

  return null
}

export async function resolveAvatarUrlMap(paths: string[]): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((path) => path && !isRemoteUrl(path))))

  if (uniquePaths.length === 0) {
    return {}
  }

  const signedResults = await Promise.all(
    uniquePaths.map(async (path) => {
      const signedResult = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60)
      if (!signedResult.error && signedResult.data?.signedUrl) {
        return [path, signedResult.data.signedUrl] as const
      }

      return [path, null] as const
    }),
  )

  const result: Record<string, string> = {}
  for (const [path, url] of signedResults) {
    if (url !== null) {
      result[path] = url
    }
  }
  return result
}