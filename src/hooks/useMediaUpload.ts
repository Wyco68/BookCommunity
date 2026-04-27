import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  uploadSessionMedia,
  getSignedMediaUrlMap,
  deleteSessionMedia,
} from '../lib/storage'
import { validateMediaFile } from '../lib/validation'
import {
  checkRateLimit,
  recordAction,
  MEDIA_UPLOAD_RATE_LIMIT,
} from '../lib/rateLimit'
import type { MediaType, SessionMedia } from '../types'

interface UseMediaUploadInput {
  sessionId: string | null
  userId: string | null
  sessionOwnerId?: string | null
  totalChapters?: number
}

interface UseMediaUploadReturn {
  media: SessionMedia[]
  mediaUrls: Record<string, string>
  loading: boolean
  uploading: boolean
  error: string | null
  uploadMedia: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  removeMedia: (mediaItem: SessionMedia) => Promise<boolean>
  loadMedia: () => Promise<void>
  hasMore: boolean
  loadMore: () => Promise<void>
  canUpload: boolean
  mediaCount: number
  mediaLimit: number
}

const PAGE_SIZE = 20

export function useMediaUpload({
  sessionId,
  userId,
  sessionOwnerId = null,
  totalChapters = 0,
}: UseMediaUploadInput): UseMediaUploadReturn {
  const [media, setMedia] = useState<SessionMedia[]>([])
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [totalMediaCount, setTotalMediaCount] = useState(0)

  const isOwner = Boolean(userId && sessionOwnerId && userId === sessionOwnerId)
  const canUpload = isOwner && totalMediaCount < totalChapters

  const loadMedia = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    const [mediaResult, countResult] = await Promise.all([
      supabase
        .from('session_media')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase
        .from('session_media')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
    ])

    if (mediaResult.error) {
      setError(mediaResult.error.message)
      setLoading(false)
      return
    }

    setTotalMediaCount(countResult.count ?? 0)

    const items = (mediaResult.data ?? []) as SessionMedia[]
    const hasMoreItems = items.length > PAGE_SIZE
    const pageItems = hasMoreItems ? items.slice(0, PAGE_SIZE) : items

    setMedia(pageItems)
    setHasMore(hasMoreItems)

    const paths = pageItems.map((m) => m.file_path)
    const urls = await getSignedMediaUrlMap(paths)
    setMediaUrls(urls)

    setLoading(false)
  }, [sessionId])

  const loadMore = useCallback(async () => {
    if (!sessionId || !hasMore || media.length === 0) return

    const lastItem = media[media.length - 1]

    const { data, error: fetchError } = await supabase
      .from('session_media')
      .select('*')
      .eq('session_id', sessionId)
      .lt('created_at', lastItem.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1)

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const items = (data ?? []) as SessionMedia[]
    const hasMoreItems = items.length > PAGE_SIZE
    const pageItems = hasMoreItems ? items.slice(0, PAGE_SIZE) : items

    const newPaths = pageItems.map((m) => m.file_path)
    const newUrls = await getSignedMediaUrlMap(newPaths)

    setMedia((prev) => [...prev, ...pageItems])
    setMediaUrls((prev) => ({ ...prev, ...newUrls }))
    setHasMore(hasMoreItems)
  }, [sessionId, hasMore, media])

  const uploadMedia = useCallback(async (
    file: File,
    mediaType: MediaType,
    description?: string,
  ): Promise<boolean> => {
    if (!sessionId || !userId) return false

    if (!isOwner) {
      setError('Only the session owner can upload media')
      return false
    }

    if (totalMediaCount >= totalChapters) {
      setError(`Media limit reached (${totalChapters} files max, one per chapter)`)
      return false
    }

    const fileValidation = validateMediaFile(file, mediaType)
    if (!fileValidation.valid) {
      setError(fileValidation.error)
      return false
    }

    const rateCheck = checkRateLimit(`media-upload:${userId}`, MEDIA_UPLOAD_RATE_LIMIT)
    if (!rateCheck.allowed) {
      setError(`Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before uploading again`)
      return false
    }

    setUploading(true)
    setError(null)

    const { path, error: uploadError } = await uploadSessionMedia(sessionId, userId, file, mediaType)
    if (uploadError) {
      setError(uploadError)
      setUploading(false)
      return false
    }

    const { error: insertError } = await supabase
      .from('session_media')
      .insert({
        session_id: sessionId,
        uploader_id: userId,
        media_type: mediaType,
        file_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        description: description?.trim() || null,
      })

    if (insertError) {
      await deleteSessionMedia(path)
      setError(insertError.message)
      setUploading(false)
      return false
    }

    recordAction(`media-upload:${userId}`, MEDIA_UPLOAD_RATE_LIMIT.windowMs)
    await loadMedia()
    setUploading(false)
    return true
  }, [sessionId, userId, isOwner, totalMediaCount, totalChapters, loadMedia])

  const removeMedia = useCallback(async (mediaItem: SessionMedia): Promise<boolean> => {
    if (!userId) return false
    setError(null)

    const { error: deleteError } = await supabase
      .from('session_media')
      .delete()
      .eq('id', mediaItem.id)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    await deleteSessionMedia(mediaItem.file_path)

    setMedia((prev) => prev.filter((m) => m.id !== mediaItem.id))
    setMediaUrls((prev) => {
      const next = { ...prev }
      delete next[mediaItem.file_path]
      return next
    })
    setTotalMediaCount((prev) => Math.max(0, prev - 1))

    return true
  }, [userId])

  return {
    media,
    mediaUrls,
    loading,
    uploading,
    error,
    uploadMedia,
    removeMedia,
    loadMedia,
    hasMore,
    loadMore,
    canUpload,
    mediaCount: totalMediaCount,
    mediaLimit: totalChapters,
  }
}
