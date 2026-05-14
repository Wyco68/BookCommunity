import { supabase } from './supabase'
import type { MediaType } from '../types'

export const SESSION_MEDIA_BUCKET = 'session-media'
export const SESSION_COVERS_BUCKET = 'session-covers'
export const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const SIGNED_URL_EXPIRY_SECONDS = 15 * 60

const AVATAR_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadAvatarFile(
  userId: string,
  file: File,
): Promise<{ path: string; error: string | null }> {
  const ext = AVATAR_MIME_TO_EXT[file.type] ?? file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    })

  return error ? { path: '', error: error.message } : { path, error: null }
}

export async function uploadSessionMedia(
  sessionId: string,
  userId: string,
  file: File,
  mediaType: MediaType,
): Promise<{ path: string; error: string | null }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${sessionId}/${userId}/${crypto.randomUUID()}.${extension}`

  let uploadFile = file

  if (mediaType === 'image' && file.size > 1024 * 1024) {
    try {
      uploadFile = await compressImage(file, 0.8, 1920)
    } catch {
      uploadFile = file
    }
  }

  const { error } = await supabase.storage
    .from(SESSION_MEDIA_BUCKET)
    .upload(path, uploadFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    return { path: '', error: error.message }
  }

  return { path, error: null }
}

export async function getSignedMediaUrl(
  filePath: string,
  bucket: string = SESSION_MEDIA_BUCKET,
): Promise<string | null> {
  if (!filePath) {
    return null
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

/**
 * Batch-resolve signed URLs in a single API call per bucket.
 * Falls back gracefully — returns partial map if some paths fail.
 */
export async function getSignedMediaUrlMap(
  filePaths: string[],
  bucket: string = SESSION_MEDIA_BUCKET,
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return {}
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data) {
    return {}
  }

  const map: Record<string, string> = {}
  for (const item of data) {
    if (item.signedUrl && item.path) {
      map[item.path] = item.signedUrl
    }
  }
  return map
}

export async function deleteSessionMedia(filePath: string): Promise<string | null> {
  const { error } = await supabase.storage
    .from(SESSION_MEDIA_BUCKET)
    .remove([filePath])

  return error ? error.message : null
}

function pathContainsSessionId(filePath: string, sessionId: string): boolean {
  const parts = filePath.split('/').filter(Boolean)
  return parts.includes(sessionId)
}

export async function deleteSessionMediaForSession(
  sessionId: string,
  filePaths: string[],
): Promise<string | null> {
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return null
  }

  const invalidPath = uniquePaths.find((filePath) => !pathContainsSessionId(filePath, sessionId))
  if (invalidPath) {
    return `Invalid media path for session cleanup: ${invalidPath}`
  }

  const chunkSize = 100
  for (let i = 0; i < uniquePaths.length; i += chunkSize) {
    const chunk = uniquePaths.slice(i, i + chunkSize)
    const { error } = await supabase.storage
      .from(SESSION_MEDIA_BUCKET)
      .remove(chunk)

    if (error) {
      return error.message
    }
  }

  return null
}

/**
 * Delete cover image(s) for a session from the session-covers bucket.
 *
 * Covers live at: `{user_id}/{session_id}/cover.{ext}`. We try the known
 * stored path first (when available) and additionally list+remove any
 * remaining objects under `{user_id}/{session_id}/` as a defensive sweep
 * to avoid orphans (e.g. abandoned uploads with a different extension).
 *
 * Returns null on success, or the first error message encountered.
 */
export async function deleteSessionCover(
  userId: string,
  sessionId: string,
  knownPath?: string | null,
): Promise<string | null> {
  if (!userId || !sessionId) {
    return null
  }

  const folder = `${userId}/${sessionId}`
  const toRemove = new Set<string>()

  if (knownPath && pathContainsSessionId(knownPath, sessionId)) {
    toRemove.add(knownPath)
  }

  const { data: listed, error: listError } = await supabase.storage
    .from(SESSION_COVERS_BUCKET)
    .list(folder, { limit: 100 })

  if (listError && !knownPath) {
    return listError.message
  }

  for (const obj of listed ?? []) {
    if (obj?.name) toRemove.add(`${folder}/${obj.name}`)
  }

  if (toRemove.size === 0) return null

  const { error: removeError } = await supabase.storage
    .from(SESSION_COVERS_BUCKET)
    .remove(Array.from(toRemove))

  return removeError ? removeError.message : null
}

async function compressImage(file: File, quality: number, maxDimension: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed'))
            return
          }
          resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }))
        },
        file.type,
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = url
  })
}
