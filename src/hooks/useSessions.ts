import { useCallback, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { notifyCreate } from '../lib/notifications'
import { getSignedMediaUrlMap, SESSION_COVERS_BUCKET } from '../lib/storage'
import type {
  Category,
  MediaType,
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
import {
  validateBookAuthor,
  validateBookTitle,
  validateDescription,
  validateJoinPolicy,
  validateTotalChapters,
  validateVisibility,
} from '../lib/validation'
import { checkRateLimit, recordAction, JOIN_REQUEST_RATE_LIMIT } from '../lib/rateLimit'

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
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  creating: boolean
  busySessionId: string | null
  loadSessions: (user: User) => Promise<void>
  loadMoreSessions: () => Promise<void>
  refreshSessions: () => Promise<void>
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

export const SESSIONS_PAGE_SIZE = 20

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const lastLoadedRef = useRef(0)
  const lastUserRef = useRef<User | null>(null)
  // Cursor for paginated discover query (created_at DESC, id DESC)
  const discoverCursorRef = useRef<{ created_at: string; id: string } | null>(null)
  const inFlightLoadRef = useRef(false)

  // Hydrate category names, cover/media previews, owner upload counts, and
  // progress-by-users for the given session set. Used by both the initial load
  // and "load more" so the additional cards are decorated identically.
  const hydrateSessionMeta = useCallback(async (
    sessionsToHydrate: ReadingSession[],
    user: User,
    mode: 'replace' | 'append',
  ) => {
    if (sessionsToHydrate.length === 0) {
      if (mode === 'replace') {
        setSessionCategoryNames({})
        setSessionFirstMedia({})
        setSessionUploadedChapterCount({})
        setSessionReadChaptersByUsers({})
      }
      return
    }

    const categoryIds = [...new Set(sessionsToHydrate.map((s) => s.category_id))]
    const ownerSessionIds = sessionsToHydrate
      .filter((s) => s.creator_id === user.id)
      .map((s) => s.id)
    const sessionIds = sessionsToHydrate.map((s) => s.id)
    const sessionsNeedingMedia = sessionsToHydrate.filter((s) => !s.cover_image_path).map((s) => s.id)

    const [catResult, progressByUsersResult, firstMediaResult, ownerCountsResult] = await Promise.all([
      supabase.from('categories').select('id,name').in('id', categoryIds),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(2000),
      sessionsNeedingMedia.length > 0
        ? supabase
            .from('session_media')
            .select('session_id,file_path,file_name,mime_type,media_type,chapter_number')
            .in('session_id', sessionsNeedingMedia)
            .eq('media_type', 'image')
            .order('chapter_number', { ascending: true })
            .limit(sessionsNeedingMedia.length * 2)
        : Promise.resolve({ data: [], error: null }),
      ownerSessionIds.length > 0
        ? supabase
            .from('session_media')
            .select('session_id')
            .in('session_id', ownerSessionIds)
            .limit(ownerSessionIds.length * 50)
        : Promise.resolve({ data: [], error: null }),
    ])

    const catLookup: Record<string, string[]> = {}
    const firstMediaLookup: Record<string, SessionCardMediaPreview> = {}
    const uploadedCountLookup: Record<string, number> = {}
    const readByUsersLookup: Record<string, number> = {}

    const catNameMap: Record<number, string> = {}
    for (const c of (catResult.data ?? []) as Category[]) {
      catNameMap[c.id] = c.name
    }
    for (const session of sessionsToHydrate) {
      const name = catNameMap[session.category_id]
      if (name) catLookup[session.id] = [name]
    }

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

    const firstMediaBySid = new Map<string, { session_id: string; file_path: string; file_name: string; mime_type: string; media_type: MediaType }>()
    for (const row of (firstMediaResult.data ?? []) as { session_id: string; file_path: string; file_name: string; mime_type: string; media_type: MediaType }[]) {
      if (!firstMediaBySid.has(row.session_id)) {
        firstMediaBySid.set(row.session_id, row)
      }
    }

    const coverPaths: string[] = []
    const mediaPaths: string[] = []

    for (const session of sessionsToHydrate) {
      if (session.cover_image_path) {
        coverPaths.push(session.cover_image_path)
      } else {
        const media = firstMediaBySid.get(session.id)
        if (media && media.mime_type.startsWith('image/')) {
          mediaPaths.push(media.file_path)
        }
      }
    }

    const [coverSignedMap, mediaSignedMap] = await Promise.all([
      coverPaths.length > 0 ? getSignedMediaUrlMap(coverPaths, SESSION_COVERS_BUCKET) : Promise.resolve({} as Record<string, string>),
      mediaPaths.length > 0 ? getSignedMediaUrlMap(mediaPaths) : Promise.resolve({} as Record<string, string>),
    ])

    for (const session of sessionsToHydrate) {
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

    if (ownerCountsResult.data && ownerCountsResult.data.length > 0) {
      const countMap = new Map<string, number>()
      for (const row of ownerCountsResult.data as { session_id: string }[]) {
        countMap.set(row.session_id, (countMap.get(row.session_id) ?? 0) + 1)
      }
      for (const [sid, count] of countMap.entries()) {
        uploadedCountLookup[sid] = count
      }
    }

    if (mode === 'replace') {
      setSessionCategoryNames(catLookup)
      setSessionFirstMedia(firstMediaLookup)
      setSessionUploadedChapterCount(uploadedCountLookup)
      setSessionReadChaptersByUsers(readByUsersLookup)
    } else {
      setSessionCategoryNames((prev) => ({ ...prev, ...catLookup }))
      setSessionFirstMedia((prev) => ({ ...prev, ...firstMediaLookup }))
      setSessionUploadedChapterCount((prev) => ({ ...prev, ...uploadedCountLookup }))
      setSessionReadChaptersByUsers((prev) => ({ ...prev, ...readByUsersLookup }))
    }
  }, [])

  const loadSessions = useCallback(async (user: User) => {
    const now = Date.now()
    if (now - lastLoadedRef.current < 2000) return
    if (inFlightLoadRef.current) return
    inFlightLoadRef.current = true
    lastLoadedRef.current = now
    lastUserRef.current = user

    setLoading(true)
    setError(null)
    discoverCursorRef.current = null

    // Initial discover page = SESSIONS_PAGE_SIZE most recent ongoing sessions.
    // Joined sessions are loaded in full so the home view is always complete.
    const [discoverResult, membershipsResult, progressResult, requestsResult] = await Promise.all([
      supabase
        .from('reading_sessions')
        .select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at')
        .eq('status_type', 'ongoing')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(SESSIONS_PAGE_SIZE),
      supabase.from('session_members').select('session_id,user_id,role').eq('user_id', user.id),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('session_join_requests').select('id,session_id,user_id,status,created_at').eq('user_id', user.id).limit(200),
    ])

    if (discoverResult.error) {
      setError(discoverResult.error.message)
      setLoading(false)
      inFlightLoadRef.current = false
      return
    }

    if (membershipsResult.error) {
      setError(membershipsResult.error.message)
      setLoading(false)
      inFlightLoadRef.current = false
      return
    }

    if (progressResult.error || requestsResult.error) {
      setError(progressResult.error?.message || requestsResult.error?.message || 'Failed to load data')
      setLoading(false)
      inFlightLoadRef.current = false
      return
    }

    const discoverData = (discoverResult.data ?? []) as ReadingSession[]
    const memberships = (membershipsResult.data ?? []) as SessionMembership[]
    const membershipLookup = buildMembershipLookup(memberships)
    const progressLookup = buildLatestProgressBySession((progressResult.data ?? []) as ProgressUpdate[])
    const requestLookup = buildJoinRequestStatusLookup((requestsResult.data ?? []) as SessionJoinRequest[])

    // Pull joined sessions that aren't already on the first discover page so
    // the home view shows every membership without forcing pagination.
    const discoverIds = new Set(discoverData.map((s) => s.id))
    const missingJoinedIds = memberships
      .map((m) => m.session_id)
      .filter((id) => !discoverIds.has(id))

    let joinedExtra: ReadingSession[] = []
    if (missingJoinedIds.length > 0) {
      const extraResult = await supabase
        .from('reading_sessions')
        .select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at')
        .in('id', missingJoinedIds)
      if (extraResult.error) {
        setError(extraResult.error.message)
        setLoading(false)
        inFlightLoadRef.current = false
        return
      }
      joinedExtra = (extraResult.data ?? []) as ReadingSession[]
    }

    const sessionsData = [...discoverData, ...joinedExtra]
    const last = discoverData[discoverData.length - 1]
    discoverCursorRef.current = last ? { created_at: last.created_at, id: last.id } : null
    setHasMore(discoverData.length === SESSIONS_PAGE_SIZE)

    setSessions(sessionsData)
    setMemberships(membershipLookup)
    setLatestProgress(progressLookup)
    setProgressDrafts(progressLookup)
    setMyJoinRequestStatus(requestLookup)
    await hydrateSessionMeta(sessionsData, user, 'replace')
    setLoading(false)
    inFlightLoadRef.current = false
  }, [hydrateSessionMeta])

  const loadMoreSessions = useCallback(async () => {
    const user = lastUserRef.current
    if (!user) return
    if (loadingMore || loading) return
    if (!hasMore) return
    const cursor = discoverCursorRef.current
    if (!cursor) return

    setLoadingMore(true)

    // Cursor pagination: rows with (created_at, id) lexicographically less than
    // the cursor. PostgREST supports tuple comparison via `.or` with `lt` clauses.
    const { data, error: pageError } = await supabase
      .from('reading_sessions')
      .select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at')
      .eq('status_type', 'ongoing')
      .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(SESSIONS_PAGE_SIZE)

    if (pageError) {
      setError(pageError.message)
      setLoadingMore(false)
      return
    }

    const pageData = (data ?? []) as ReadingSession[]
    setHasMore(pageData.length === SESSIONS_PAGE_SIZE)

    if (pageData.length === 0) {
      setLoadingMore(false)
      return
    }

    const newLast = pageData[pageData.length - 1]
    discoverCursorRef.current = { created_at: newLast.created_at, id: newLast.id }

    setSessions((prev) => {
      const seen = new Set(prev.map((s) => s.id))
      const additions = pageData.filter((s) => !seen.has(s.id))
      return additions.length === 0 ? prev : [...prev, ...additions]
    })
    await hydrateSessionMeta(pageData, user, 'append')
    setLoadingMore(false)
  }, [hasMore, loading, loadingMore, hydrateSessionMeta])

  const refreshSessions = useCallback(async () => {
    const user = lastUserRef.current
    if (!user) return
    lastLoadedRef.current = 0
    await loadSessions(user)
  }, [loadSessions])

  const createSession = useCallback(async (user: User, form: SessionFormState) => {
    const titleCheck = validateBookTitle(form.bookTitle)
    if (!titleCheck.valid) {
      setError(titleCheck.error ?? 'Invalid book title')
      return
    }
    const authorCheck = validateBookAuthor(form.bookAuthor)
    if (!authorCheck.valid) {
      setError(authorCheck.error ?? 'Invalid author')
      return
    }
    const chaptersCheck = validateTotalChapters(form.totalChapters)
    if (!chaptersCheck.valid) {
      setError(chaptersCheck.error ?? 'Invalid chapter count')
      return
    }
    const descCheck = validateDescription(form.description)
    if (!descCheck.valid) {
      setError(descCheck.error ?? 'Invalid description')
      return
    }
    const visCheck = validateVisibility(form.visibility)
    if (!visCheck.valid) {
      setError(visCheck.error ?? 'Invalid visibility')
      return
    }
    const joinCheck = validateJoinPolicy(form.joinPolicy)
    if (!joinCheck.valid) {
      setError(joinCheck.error ?? 'Invalid join policy')
      return
    }

    setCreating(true)
    setError(null)

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
    lastLoadedRef.current = 0
    void loadSessions(user)
  }, [loadSessions])

  const joinSession = useCallback(async (sessionId: string, user: User) => {
    const targetSession = sessions.find((session) => session.id === sessionId)
    if (!targetSession) return

    if (targetSession.join_policy === 'request') {
      const rateCheck = checkRateLimit(`join-request:${user.id}`, JOIN_REQUEST_RATE_LIMIT)
      if (!rateCheck.allowed) {
        setError(`Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before sending another join request`)
        return
      }

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
      } else {
        recordAction(`join-request:${user.id}`, JOIN_REQUEST_RATE_LIMIT.windowMs)
        notifyCreate({ type: 'JOIN_REQUESTED', sessionId, actorId: user.id })
        lastLoadedRef.current = 0
        void loadSessions(user)
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

    notifyCreate({ type: 'SESSION_JOINED', sessionId, actorId: user.id })

    setBusySessionId(null)
    lastLoadedRef.current = 0
    void loadSessions(user)
  }, [sessions, loadSessions])

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
    lastLoadedRef.current = 0
    void loadSessions(user)
  }, [loadSessions])

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

      // Sequential rule: only allow current (no-op) or current + 1.
      // Block backward overwrite — keep DB monotonic.
      const currentLatest = latestProgress[session.id] ?? 0
      if (chapter !== currentLatest && chapter !== currentLatest + 1) {
        setError(`Progress must advance one chapter at a time (current: ${currentLatest})`)
        return
      }
      if (chapter <= currentLatest) return // already saved

      setBusySessionId(session.id)
      setError(null)

      // Defensive: use auth user at insert time. RLS enforces user_id = auth.uid().
      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id ?? user.id

      const { error } = await supabase.from('progress_updates').insert({
        session_id: session.id,
        user_id: authUserId,
        chapter_number: chapter,
      })

      if (error) {
        setError(error.message)
        setBusySessionId(null)
        return
      }

      setBusySessionId(null)
      lastLoadedRef.current = 0
      void loadSessions(user)
    },
    [loadSessions, latestProgress],
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
    loadingMore,
    hasMore,
    error,
    creating,
    busySessionId,
    loadSessions,
    loadMoreSessions,
    refreshSessions,
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