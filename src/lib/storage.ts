import { supabase } from './supabase'
import type { MediaType } from '../types'

export const SESSION_MEDIA_BUCKET = 'session-media'
const SIGNED_URL_EXPIRY_SECONDS = 15 * 60

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

export async function getSignedMediaUrl(filePath: string): Promise<string | null> {
  if (!filePath) {
    return null
  }

  const { data, error } = await supabase.storage
    .from(SESSION_MEDIA_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

export async function getSignedMediaUrlMap(filePaths: string[]): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(filePaths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return {}
  }

  const results = await Promise.all(
    uniquePaths.map(async (path) => {
      const url = await getSignedMediaUrl(path)
      return [path, url] as const
    }),
  )

  const map: Record<string, string> = {}
  for (const [path, url] of results) {
    if (url) {
      map[path] = url
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
