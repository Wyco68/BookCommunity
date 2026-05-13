import { useCallback, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getSignedMediaUrlMap, SESSION_COVERS_BUCKET } from '../lib/storage'
import type {
  Category,
  ReadingSession,
  SessionMembership,
  SessionJoinRequest,
  ProgressUpdate,
  SessionCardMediaPreview,
} from '../types'
import {
  buildJoinRequestStatusLookup,
  buildLatestProgressBySession,
  buildMembershipLookup,
} from '../lib/sessionData'

export interface SessionFormState {
  bookTitle: string
  bookAuthor: string
  totalChapters: number
  description: string
  visibility: 'public' | 'private'
  joinPolicy: 'open' | 'request'
  categoryId: number
}

export const defaultSessionForm: SessionFormState = {
  bookTitle: '',
  bookAuthor: '',
  totalChapters: 12,
  description: '',
  visibility: 'public',
  joinPolicy: 'open',
  categoryId: 0,
}

export interface UseSessionsReturn {
  sessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  latestProgress: Record<string, number>
  progressDrafts: Record<string, number>
  myJoinRequestStatus: Record<string, SessionJoinRequest['status']>
  sessionCategoryNames: Record<string, string[]>
  sessionFirstMedia: Record<string, SessionCardMediaPreview>
  sessionUploadedChapterCount: Record<string, number>
  sessionReadChaptersByUsers: Record<string, number>
  loading: boolean
  error: string | null
  creating: boolean
  busySessionId: string | null
  loadSessions: (user: User) => Promise<void>
  createSession: (user: User, form: SessionFormState) => Promise<void>
  joinSession: (sessionId: string, user: User) => Promise<void>
  leaveSession: (sessionId: string, user: User) => Promise<void>
  updateProgress: (session: ReadingSession, chapter: number, user: User) => Promise<void>
  setSessions: React.Dispatch<React.SetStateAction<ReadingSession[]>>
  setMemberships: React.Dispatch<React.SetStateAction<Record<string, SessionMembership>>>
  setLatestProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setProgressDrafts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setMyJoinRequestStatus: React.Dispatch<React.SetStateAction<Record<string, SessionJoinRequest['status']>>>
  setSessionCategoryNames: React.Dispatch<React.SetStateAction<Record<string, string[]>>>
  setSessionFirstMedia: React.Dispatch<React.SetStateAction<Record<string, SessionCardMediaPreview>>>
  setSessionUploadedChapterCount: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setSessionReadChaptersByUsers: React.Dispatch<React.SetStateAction<Record<string, number>>>
  removeSession: (sessionId: string) => void
  setError: (error: string | null) => void
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [memberships, setMemberships] = useState<Record<string, SessionMembership>>({})
  const [latestProgress, setLatestProgress] = useState<Record<string, number>>({})
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({})
  const [myJoinRequestStatus, setMyJoinRequestStatus] = useState<Record<string, SessionJoinRequest['status']>>({})
  const [sessionCategoryNames, setSessionCategoryNames] = useState<Record<string, string[]>>({})
  const [sessionFirstMedia, setSessionFirstMedia] = useState<Record<string, SessionCardMediaPreview>>({})
  const [sessionUploadedChapterCount, setSessionUploadedChapterCount] = useState<Record<string, number>>({})
  const [sessionReadChaptersByUsers, setSessionReadChaptersByUsers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const lastLoadedRef = useRef(0)

  const loadSessions = useCallback(async (user: User) => {
    const now = Date.now()
    if (now - lastLoadedRef.current < 2000) return
    lastLoadedRef.current = now

    setLoading(true)
    setError(null)

    const [sessionsResult, membershipsResult, progressResult, requestsResult] = await Promise.all([
      supabase.from('reading_sessions').select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at').eq('status_type', 'ongoing').order('created_at', { ascending: false }).limit(200),
      supabase.from('session_members').select('session_id,user_id,role').eq('user_id', user.id),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('session_join_requests').select('id,session_id,user_id,status,created_at').eq('user_id', user.id).limit(200),
    ])

    if (sessionsResult.error) {
      setError(sessionsResult.error.message)
      setLoading(false)
      return
    }

    if (membershipsResult.error) {
      setError(membershipsResult.error.message)
      setLoading(false)
      return
    }

    if (progressResult.error || requestsResult.error) {
      setError(progressResult.error?.message || requestsResult.error?.message || 'Failed to load data')
      setLoading(false)
      return
    }

    const sessionsData = (sessionsResult.data ?? []) as ReadingSession[]
    const membershipLookup = buildMembershipLookup((membershipsResult.data ?? []) as SessionMembership[])
    const progressLookup = buildLatestProgressBySession((progressResult.data ?? []) as ProgressUpdate[])
    const requestLookup = buildJoinRequestStatusLookup((requestsResult.data ?? []) as SessionJoinRequest[])

    // Build category name lookup directly from session.category_id
    const sessionIds = sessionsData.map((s) => s.id)
    const catLookup: Record<string, string[]> = {}
    const firstMediaLookup: Record<string, SessionCardMediaPreview> = {}
    const uploadedCountLookup: Record<string, number> = {}
    const readByUsersLookup: Record<string, number> = {}
    if (sessionIds.length > 0) {
      // --- Batch: categories, progress-by-users, first-media, owner-counts ---
      const categoryIds = [...new Set(sessionsData.map((s) => s.category_id))]
      const ownerSessionIds = sessionsData
        .filter((s) => s.creator_id === user.id)
        .map((s) => s.id)

      // Sessions without a cover_image_path need a first-media fallback
      const sessionsNeedingMedia = sessionsData.filter((s) => !s.cover_image_path).map((s) => s.id)

      const [catResult, progressByUsersResult, firstMediaResult, ownerCountsResult] = await Promise.all([
        // 1) Category names (single query, small table)
        supabase.from('categories').select('id,name').in('id', categoryIds),
        // 2) Progress across all sessions (single query, bounded)
        supabase
          .from('progress_updates')
          .select('session_id,user_id,chapter_number,created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
          .limit(2000),
        // 3) First image media for sessions without covers (single batched query)
        sessionsNeedingMedia.length > 0
          ? supabase
              .from('session_media')
              .select('session_id,file_path,file_name,mime_type,media_type,chapter_number')
              .in('session_id', sessionsNeedingMedia)
              .eq('media_type', 'image')
              .order('chapter_number', { ascending: true })
              .limit(sessionsNeedingMedia.length * 2)
          : Promise.resolve({ data: [], error: null }),
        // 4) Owner upload counts (single batched query)
        ownerSessionIds.length > 0
          ? supabase
              .from('session_media')
              .select('session_id')
              .in('session_id', ownerSessionIds)
              .limit(ownerSessionIds.length * 50)
          : Promise.resolve({ data: [], error: null }),
      ])

      // Process categories
      const catNameMap: Record<number, string> = {}
      for (const c of (catResult.data ?? []) as Category[]) {
        catNameMap[c.id] = c.name
      }
      for (const session of sessionsData) {
        const name = catNameMap[session.category_id]
        if (name) catLookup[session.id] = [name]
      }

      // Process progress by users
      const progressByUsers = progressByUsersResult.data
      if (progressByUsers && progressByUsers.length > 0) {
        const latestBySessionAndUser = new Map<string, number>()
        for (const item of progressByUsers as ProgressUpdate[]) {
          const key = `${item.session_id}:${item.user_id}`
          if (!latestBySessionAndUser.has(key)) {
            latestBySessionAndUser.set(key, item.chapter_number)
          }
        }

        for (const [key, chapter] of latestBySessionAndUser.entries()) {
          const sessionId = key.split(':')[0]
          readByUsersLookup[sessionId] = (readByUsersLookup[sessionId] ?? 0) + chapter
        }
      }

      // Process first media — pick first image per session from batched results
      const firstMediaBySid = new Map<string, { session_id: string; file_path: string; file_name: string; mime_type: string; media_type: string }>()
      for (const row of (firstMediaResult.data ?? []) as { session_id: string; file_path: string; file_name: string; mime_type: string; media_type: string }[]) {
        if (!firstMediaBySid.has(row.session_id)) {
          firstMediaBySid.set(row.session_id, row)
        }
      }

      // Build combined cover/media items for batch signed URL resolution
      const coverPaths: string[] = []
      const mediaPaths: string[] = []
      const coverSessionMap: Record<string, string> = {} // path -> session_id
      const mediaSessionMap: Record<string, string> = {} // path -> session_id

      for (const session of sessionsData) {
        if (session.cover_image_path) {
          coverPaths.push(session.cover_image_path)
          coverSessionMap[session.cover_image_path] = session.id
        } else {
          const media = firstMediaBySid.get(session.id)
          if (media && media.mime_type.startsWith('image/')) {
            mediaPaths.push(media.file_path)
            mediaSessionMap[media.file_path] = session.id
          }
        }
      }

      // Batch sign URLs (1 call per bucket instead of N calls)
      const [coverSignedMap, mediaSignedMap] = await Promise.all([
        coverPaths.length > 0 ? getSignedMediaUrlMap(coverPaths, SESSION_COVERS_BUCKET) : Promise.resolve({}),
        mediaPaths.length > 0 ? getSignedMediaUrlMap(mediaPaths) : Promise.resolve({}),
      ])

      // Assemble firstMediaLookup from signed URL maps
      for (const session of sessionsData) {
        if (session.cover_image_path) {
          firstMediaLookup[session.id] = {
            session_id: session.id,
            file_path: session.cover_image_path,
            file_name: 'cover',
            mime_type: 'image/jpeg',
            media_type: 'image',
            is_image: true,
            signed_url: coverSignedMap[session.cover_image_path] ?? null,
          }
        } else {
          const media = firstMediaBySid.get(session.id)
          if (media) {
            const isImage = media.mime_type.startsWith('image/')
            firstMediaLookup[session.id] = {
              session_id: session.id,
              file_path: media.file_path,
              file_name: media.file_name,
              mime_type: media.mime_type,
              media_type: media.media_type,
              is_image: isImage,
              signed_url: isImage ? (mediaSignedMap[media.file_path] ?? null) : null,
            }
          }
        }
      }

      // Process owner upload counts from batched result
      if (ownerCountsResult.data && ownerCountsResult.data.length > 0) {
        const countMap = new Map<string, number>()
        for (const row of ownerCountsResult.data as { session_id: string }[]) {
          countMap.set(row.session_id, (countMap.get(row.session_id) ?? 0) + 1)
        }
        for (const [sid, count] of countMap.entries()) {
          uploadedCountLookup[sid] = count
        }
      }
    }

    setSessions(sessionsData)
    setMemberships(membershipLookup)
    setLatestProgress(progressLookup)
    setProgressDrafts(progressLookup)
    setMyJoinRequestStatus(requestLookup)
    setSessionCategoryNames(catLookup)
    setSessionFirstMedia(firstMediaLookup)
    setSessionUploadedChapterCount(uploadedCountLookup)
    setSessionReadChaptersByUsers(readByUsersLookup)
    setLoading(false)
  }, [])

  const createSession = useCallback(async (user: User, form: SessionFormState) => {
    if (!form.bookTitle.trim() || !form.bookAuthor.trim()) {
      setError('Book title and author are required')
      return
    }

    setCreating(true)
    setError(null)

    const profileUpsert = await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' })
    if (profileUpsert.error) {
      setError(profileUpsert.error.message)
      setCreating(false)
      return
    }

    const createResult = await supabase.rpc('create_reading_session', {
      p_book_title: form.bookTitle.trim(),
      p_book_author: form.bookAuthor.trim(),
      p_total_chapters: form.totalChapters,
      p_description: form.description.trim() || null,
      p_visibility: form.visibility,
      p_join_policy: form.joinPolicy,
      p_category_id: form.categoryId,
    })

    if (createResult.error) {
      setError(createResult.error.message)
      setCreating(false)
      return
    }

    setCreating(false)
  }, [])

  const joinSession = useCallback(async (sessionId: string, user: User) => {
    const targetSession = sessions.find((session) => session.id === sessionId)
    if (!targetSession) return

    if (targetSession.join_policy === 'request') {
      setBusySessionId(sessionId)
      const { error } = await supabase.from('session_join_requests').upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          status: 'pending',
        },
        { onConflict: 'session_id,user_id' },
      )

      if (error) {
        setError(error.message)
      }
      setBusySessionId(null)
      return
    }

    setBusySessionId(sessionId)
    setError(null)

    const { error } = await supabase.from('session_members').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'member',
    })

    if (error) {
      setError(error.message)
      setBusySessionId(null)
      return
    }

    setBusySessionId(null)
  }, [sessions])

  const leaveSession = useCallback(async (sessionId: string, user: User) => {
    setBusySessionId(sessionId)
    setError(null)

    const { error } = await supabase
      .from('session_members')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      setError(error.message)
      setBusySessionId(null)
      return
    }

    setBusySessionId(null)
  }, [])

  const removeSession = useCallback((sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    setMemberships((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setLatestProgress((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setProgressDrafts((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setMyJoinRequestStatus((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setSessionCategoryNames((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setSessionFirstMedia((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setSessionUploadedChapterCount((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    setSessionReadChaptersByUsers((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
  }, [])

  const updateProgress = useCallback(
    async (session: ReadingSession, chapter: number, user: User) => {
      if (!chapter || chapter < 1 || chapter > session.total_chapters) {
        setError(`Chapter must be between 1 and ${session.total_chapters}`)
        return
      }

      setBusySessionId(session.id)
      setError(null)

      const { error } = await supabase.from('progress_updates').insert({
        session_id: session.id,
        user_id: user.id,
        chapter_number: chapter,
      })

      if (error) {
        setError(error.message)
        setBusySessionId(null)
        return
      }

      setBusySessionId(null)
    },
    [],
  )

  return {
    sessions,
    memberships,
    latestProgress,
    progressDrafts,
    myJoinRequestStatus,
    sessionCategoryNames,
    sessionFirstMedia,
    sessionUploadedChapterCount,
    sessionReadChaptersByUsers,
    loading,
    error,
    creating,
    busySessionId,
    loadSessions,
    createSession,
    joinSession,
    leaveSession,
    updateProgress,
    removeSession,
    setSessions,
    setMemberships,
    setLatestProgress,
    setProgressDrafts,
    setMyJoinRequestStatus,
    setSessionCategoryNames,
    setSessionFirstMedia,
    setSessionUploadedChapterCount,
    setSessionReadChaptersByUsers,
    setError: setError,
  }
}