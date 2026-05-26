import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyCreate } from '../lib/notifications'
import { uploadSessionMedia, deleteSessionMedia } from '../lib/storage'
import { validateMediaFile } from '../lib/validation'
import { checkRateLimit, recordAction, MEDIA_UPLOAD_RATE_LIMIT } from '../lib/rateLimit'
import type { MediaType } from '../types'

interface UseMediaUploadInput {
  sessionId: string | null
  userId: string | null
  sessionOwnerId?: string | null
  totalChapters?: number
}

interface UseMediaUploadReturn {
  uploading: boolean
  error: string | null
  uploadMedia: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  loadMediaMeta: () => Promise<void>
  canUpload: boolean
  mediaCount: number
  mediaLimit: number
  maxUploadedChapter: number
  nextChapter: number
}

export function useMediaUpload({
  sessionId,
  userId,
  sessionOwnerId = null,
  totalChapters = 0,
}: UseMediaUploadInput): UseMediaUploadReturn {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalMediaCount, setTotalMediaCount] = useState(0)
  const [maxUploadedChapter, setMaxUploadedChapter] = useState(0)

  const isOwner = Boolean(userId && sessionOwnerId && userId === sessionOwnerId)
  const canUpload = isOwner && totalMediaCount < totalChapters
  const nextChapter = maxUploadedChapter + 1

  const loadMediaMeta = useCallback(async () => {
    if (!sessionId) return

    const [countResult, maxChapterResult] = await Promise.all([
      supabase
        .from('session_media')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
      supabase
        .from('session_media')
        .select('chapter_number')
        .eq('session_id', sessionId)
        .order('chapter_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    setTotalMediaCount(countResult.count ?? 0)
    setMaxUploadedChapter(maxChapterResult.data?.chapter_number ?? 0)
  }, [sessionId])

  const uploadMedia = useCallback(
    async (file: File, mediaType: MediaType, description?: string): Promise<boolean> => {
      if (!sessionId || !userId) return false

      if (!isOwner) {
        setError('Only the session owner can upload media')
        return false
      }

      if (totalMediaCount >= totalChapters) {
        setError(`All ${totalChapters} chapters have been uploaded.`)
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

      // Re-query max chapter at upload time for accuracy
      const maxChapterRow = await supabase
        .from('session_media')
        .select('chapter_number')
        .eq('session_id', sessionId)
        .order('chapter_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      const currentMax = maxChapterRow.data?.chapter_number ?? 0
      const nextChapterNum = currentMax + 1

      if (nextChapterNum > totalChapters) {
        setError(`All ${totalChapters} chapters have been uploaded.`)
        setUploading(false)
        return false
      }

      const { path, error: uploadError } = await uploadSessionMedia(sessionId, userId, file, mediaType)
      if (uploadError) {
        setError(uploadError)
        setUploading(false)
        return false
      }

      const { error: insertError } = await supabase.from('session_media').insert({
        session_id: sessionId,
        uploader_id: userId,
        chapter_number: nextChapterNum,
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
      
      notifyCreate({
        type: 'CHAPTER_UPDATED',
        sessionId,
        actorId: userId,
        metadata: { chapterId: nextChapterNum },
      })

      await loadMediaMeta()
      setUploading(false)
      return true
    },
    [sessionId, userId, isOwner, totalMediaCount, totalChapters, loadMediaMeta],
  )


  return {
    uploading,
    error,
    uploadMedia,
    loadMediaMeta,
    canUpload,
    mediaCount: totalMediaCount,
    mediaLimit: totalChapters,
    maxUploadedChapter,
    nextChapter,
  }
}
