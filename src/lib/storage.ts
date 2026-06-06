import { supabase } from './supabase'
import type { MediaType } from '../types'

export const SESSION_MEDIA_BUCKET = 'session-media'
export const SESSION_COVERS_BUCKET = 'session-covers'
export const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const SIGNED_URL_EXPIRY_SECONDS = 5 * 60

const AVATAR_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const SESSION_MEDIA_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
}

export async function uploadAvatarFile(
  userId: string,
  file: File,
): Promise<{ path: string; error: string | null }> {
  const ext = AVATAR_MIME_TO_EXT[file.type] ?? 'jpg'
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

/**
 * Remove avatar objects under {userId}/ except an optional path to keep.
 * Handles extension changes (e.g. avatar.jpg → avatar.png).
 */
export async function deleteUserAvatarFiles(
  userId: string,
  keepPath?: string | null,
): Promise<string | null> {
  const { data: listed, error: listError } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .list(userId, { limit: 100 })

  if (listError) {
    return listError.message
  }

  const toRemove = (listed ?? [])
    .filter((obj) => obj?.name)
    .map((obj) => `${userId}/${obj.name}`)
    .filter((path) => path !== keepPath)

  if (toRemove.length === 0) {
    return null
  }

  const { error: removeError } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .remove(toRemove)

  return removeError ? removeError.message : null
}

export async function uploadSessionMedia(
  sessionId: string,
  userId: string,
  file: File,
  mediaType: MediaType,
  contentType: string = file.type,
): Promise<{ path: string; error: string | null }> {
  const extension = SESSION_MEDIA_MIME_TO_EXT[contentType] ?? 'bin'
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
      contentType,
    })

  if (error) {
    return { path: '', error: error.message }
  }

  return { path, error: null }
}

/**
 * Fetch signed storage content into a same-origin blob URL so privacy browsers
 * (e.g. Brave Shields) do not block cross-origin iframe/embed loads.
 */
export async function fetchBlobUrlFromSignedUrl(
  signedUrl: string,
  mimeType: string,
): Promise<{ url: string; revoke: () => void } | null> {
  try {
    const response = await fetch(signedUrl)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const typedBlob =
      mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob
    const url = URL.createObjectURL(typedBlob)

    return { url, revoke: () => URL.revokeObjectURL(url) }
  } catch {
    return null
  }
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
 * Covers live at: `{user_id}/{session_id}/cover.{ext}`. When a trusted
 * `knownPath` is present, we remove only that object (skip folder list —
 * list can 400 under strict storage RLS). Otherwise we list the folder
 * and remove all objects as a defensive sweep for orphan filenames.
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

  const trimmedKnown = knownPath?.trim() ?? ''
  const hasTrustedKnownPath =
    trimmedKnown.length > 0 && pathContainsSessionId(trimmedKnown, sessionId)

  if (hasTrustedKnownPath) {
    toRemove.add(trimmedKnown)
  } else {
    const { data: listed, error: listError } = await supabase.storage
      .from(SESSION_COVERS_BUCKET)
      .list(folder, { limit: 100 })

    if (listError) {
      return listError.message
    }

    for (const obj of listed ?? []) {
      if (obj?.name) toRemove.add(`${folder}/${obj.name}`)
    }
  }

  const paths = Array.from(toRemove).filter((p) => typeof p === 'string' && p.length > 0)
  if (paths.length === 0) return null

  const { error: removeError } = await supabase.storage
    .from(SESSION_COVERS_BUCKET)
    .remove(paths)

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
