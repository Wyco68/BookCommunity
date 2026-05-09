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
  maxUploadedChapter: number
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
  const [page, setPage] = useState(0)
  const [totalMediaCount, setTotalMediaCount] = useState(0)
  const [maxUploadedChapter, setMaxUploadedChapter] = useState(0)

  const isOwner = Boolean(userId && sessionOwnerId && userId === sessionOwnerId)
  const canUpload = isOwner && totalMediaCount < totalChapters

  const loadMedia = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setError(null)

    const [mediaResult, countResult, maxChapterResult] = await Promise.all([
      supabase
        .from('session_media')
        .select('id,session_id,uploader_id,chapter_number,media_type,file_path,file_name,file_size_bytes,mime_type,description,created_at')
        .eq('session_id', sessionId)
        .order('chapter_number', { ascending: true })
        .order('created_at', { ascending: true })
        .range(0, PAGE_SIZE - 1),
      supabase
        .from('session_media')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
      supabase
        .from('session_media')
        .select('chapter_number')
        .eq('session_id', sessionId)
        .order('chapter_number', { ascending: false })
        .limit(1),
    ])

    if (mediaResult.error) {
      setError(mediaResult.error.message)
      setLoading(false)
      return
    }

    setTotalMediaCount(countResult.count ?? 0)
    setMaxUploadedChapter(maxChapterResult.data?.[0]?.chapter_number ?? 0)

    const items = (mediaResult.data ?? []) as SessionMedia[]
    const hasMoreItems = (countResult.count ?? 0) > items.length

    setPage(0)
    setMedia(items)
    setHasMore(hasMoreItems)

    const paths = items.map((m) => m.file_path)
    const urls = await getSignedMediaUrlMap(paths)
    setMediaUrls(urls)

    setLoading(false)
  }, [sessionId])

  const loadMore = useCallback(async () => {
    if (!sessionId || !hasMore) return
    const nextPage = page + 1
    const start = nextPage * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    const { data, error: fetchError } = await supabase
      .from('session_media')
      .select('id,session_id,uploader_id,chapter_number,media_type,file_path,file_name,file_size_bytes,mime_type,description,created_at')
      .eq('session_id', sessionId)
      .order('chapter_number', { ascending: true })
      .order('created_at', { ascending: true })
      .range(start, end)

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const items = (data ?? []) as SessionMedia[]

    const newPaths = items.map((m) => m.file_path)
    const newUrls = await getSignedMediaUrlMap(newPaths)

    setMedia((prev) => [...prev, ...items])
    setMediaUrls((prev) => ({ ...prev, ...newUrls }))
    const nextCount = start + items.length
    setHasMore(nextCount < totalMediaCount)
    setPage(nextPage)
  }, [sessionId, hasMore, page, totalMediaCount])

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
        chapter_number: 1,
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
    maxUploadedChapter,
  }
}
