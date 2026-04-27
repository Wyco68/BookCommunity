import { useCallback, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { ReadingSession, SessionMembership, SessionJoinRequest, ProgressUpdate } from '../types'
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
}

export const defaultSessionForm: SessionFormState = {
  bookTitle: '',
  bookAuthor: '',
  totalChapters: 12,
  description: '',
  visibility: 'public',
  joinPolicy: 'open',
}

export interface UseSessionsReturn {
  sessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  latestProgress: Record<string, number>
  progressDrafts: Record<string, number>
  myJoinRequestStatus: Record<string, SessionJoinRequest['status']>
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
  setError: (error: string | null) => void
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [memberships, setMemberships] = useState<Record<string, SessionMembership>>({})
  const [latestProgress, setLatestProgress] = useState<Record<string, number>>({})
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({})
  const [myJoinRequestStatus, setMyJoinRequestStatus] = useState<Record<string, SessionJoinRequest['status']>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)

  const loadSessions = useCallback(async (user: User) => {
    setLoading(true)
    setError(null)

    const [sessionsResult, membershipsResult, progressResult, requestsResult] = await Promise.all([
      supabase.from('reading_sessions').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('session_members').select('session_id,user_id,role').eq('user_id', user.id),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('session_join_requests').select('id,session_id,user_id,status,created_at').eq('user_id', user.id),
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

    const membershipLookup = buildMembershipLookup((membershipsResult.data ?? []) as SessionMembership[])
    const progressLookup = buildLatestProgressBySession((progressResult.data ?? []) as ProgressUpdate[])
    const requestLookup = buildJoinRequestStatusLookup((requestsResult.data ?? []) as SessionJoinRequest[])

    setSessions((sessionsResult.data ?? []) as ReadingSession[])
    setMemberships(membershipLookup)
    setLatestProgress(progressLookup)
    setProgressDrafts(progressLookup)
    setMyJoinRequestStatus(requestLookup)
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
    })

    if (createResult.error) {
      setError(createResult.error.message)
      setCreating(false)
      return
    }

    const createdSession = createResult.data as ReadingSession
    const membershipResult = await supabase.from('session_members').insert({
      session_id: createdSession.id,
      user_id: user.id,
      role: 'owner',
    })

    if (membershipResult.error) {
      setError(membershipResult.error.message)
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
    loading,
    error,
    creating,
    busySessionId,
    loadSessions,
    createSession,
    joinSession,
    leaveSession,
    updateProgress,
    setSessions,
    setMemberships,
    setLatestProgress,
    setProgressDrafts,
    setMyJoinRequestStatus,
    setError: setError,
  }
}