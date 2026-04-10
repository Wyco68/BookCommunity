import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { translations } from './i18n'
import type { Language } from './i18n'
import type {
  Comment,
  CommentLike,
  Profile,
  ProgressUpdate,
  ReadingSession,
  SessionJoinRequest,
  SessionMembership,
} from './types'
import {
  buildCommentMeta,
  buildLatestChapterByUser,
  filterSessions,
  getPreferredSelectedSessionId,
} from './lib/sessionState'
import './App.css'

type AuthMode = 'sign-in' | 'sign-up'

interface SessionFormState {
  bookTitle: string
  bookAuthor: string
  totalChapters: number
  description: string
  visibility: 'public' | 'private'
  joinPolicy: 'open' | 'request'
}

const defaultSessionForm: SessionFormState = {
  bookTitle: '',
  bookAuthor: '',
  totalChapters: 12,
  description: '',
  visibility: 'public',
  joinPolicy: 'open',
}

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const LANGUAGE_STORAGE_KEY = 'books-friends-language'

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function getInitials(label: string | null | undefined): string {
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

function getAvatarExtension(file: File): string {
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

async function resolveAvatarUrl(pathOrUrl: string | null): Promise<string | null> {
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

  const publicResult = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(pathOrUrl)
  return publicResult.data.publicUrl
}

async function resolveAvatarUrlMap(paths: string[]): Promise<Record<string, string>> {
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

      const publicResult = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      return [path, publicResult.data.publicUrl] as const
    }),
  )

  return Object.fromEntries(signedResults)
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return saved === 'my' ? 'my' : 'en'
  })
  const t = translations[language]
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  const [sessions, setSessions] = useState<ReadingSession[]>([])
  const [memberships, setMemberships] = useState<Record<string, SessionMembership>>({})
  const [latestProgress, setLatestProgress] = useState<Record<string, number>>({})
  const [screenError, setScreenError] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionForm, setSessionForm] = useState<SessionFormState>(defaultSessionForm)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({})

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionComments, setSessionComments] = useState<Comment[]>([])
  const [sessionLikes, setSessionLikes] = useState<CommentLike[]>([])
  const [sessionMembers, setSessionMembers] = useState<SessionMembership[]>([])
  const [sessionProgress, setSessionProgress] = useState<ProgressUpdate[]>([])
  const [sessionProfiles, setSessionProfiles] = useState<Record<string, Profile>>({})
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null)
  const [sessionJoinRequests, setSessionJoinRequests] = useState<SessionJoinRequest[]>([])
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)

  const [sessionView, setSessionView] = useState<'active' | 'archived'>('active')
  const [sessionSearch, setSessionSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [myJoinRequestStatus, setMyJoinRequestStatus] = useState<Record<string, SessionJoinRequest['status']>>({})

  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [myAvatarRenderUrl, setMyAvatarRenderUrl] = useState<string | null>(null)
  const [avatarInputKey, setAvatarInputKey] = useState(0)

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  const loadAppData = useCallback(async (activeUser: User) => {
    setLoadingSessions(true)
    setScreenError(null)

    const [sessionsResult, membershipsResult, progressResult, requestsResult] = await Promise.all([
      supabase.from('reading_sessions').select('*').in('status', ['active', 'archived']).order('created_at', { ascending: false }),
      supabase.from('session_members').select('session_id,user_id,role').eq('user_id', activeUser.id),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('user_id', activeUser.id)
        .order('created_at', { ascending: false }),
      supabase.from('session_join_requests').select('id,session_id,user_id,status,created_at').eq('user_id', activeUser.id),
    ])

    if (sessionsResult.error) {
      setScreenError(sessionsResult.error.message)
      setLoadingSessions(false)
      return
    }

    if (membershipsResult.error) {
      setScreenError(membershipsResult.error.message)
      setLoadingSessions(false)
      return
    }

    if (progressResult.error || requestsResult.error) {
      setScreenError(progressResult.error?.message || requestsResult.error?.message || 'Failed to load data')
      setLoadingSessions(false)
      return
    }

    const membershipLookup: Record<string, SessionMembership> = {}
    for (const membership of membershipsResult.data as SessionMembership[]) {
      membershipLookup[membership.session_id] = membership
    }

    const progressLookup: Record<string, number> = {}
    for (const update of progressResult.data as ProgressUpdate[]) {
      if (!(update.session_id in progressLookup)) {
        progressLookup[update.session_id] = update.chapter_number
      }
    }

    const requestLookup: Record<string, SessionJoinRequest['status']> = {}
    for (const request of (requestsResult.data ?? []) as SessionJoinRequest[]) {
      requestLookup[request.session_id] = request.status
    }

    setSessions((sessionsResult.data ?? []) as ReadingSession[])
    setMemberships(membershipLookup)
    setLatestProgress(progressLookup)
    setProgressDrafts(progressLookup)
    setMyJoinRequestStatus(requestLookup)
    setLoadingSessions(false)
  }, [])

  const loadMyProfile = useCallback(async (activeUser: User) => {
    const upsertResult = await supabase.from('profiles').upsert({ id: activeUser.id }, { onConflict: 'id' })
    if (upsertResult.error) {
      setScreenError(upsertResult.error.message)
      return
    }

    const profileResult = await supabase
      .from('profiles')
      .select('id,display_name,avatar_url')
      .eq('id', activeUser.id)
      .maybeSingle()

    if (profileResult.error) {
      setScreenError(profileResult.error.message)
      return
    }

    const profile = (profileResult.data ?? { id: activeUser.id, display_name: null, avatar_url: null }) as Profile
    const avatarUrl = await resolveAvatarUrl(profile.avatar_url)

    setMyProfile(profile)
    setProfileNameDraft(profile.display_name ?? '')
    setMyAvatarRenderUrl(avatarUrl)
  }, [])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setLoadingSessionDetail(true)

    const [commentsResult, membersResult, progressResult, requestsResult] = await Promise.all([
      supabase.from('comments').select('id,session_id,user_id,body,is_deleted,created_at').eq('session_id', sessionId).order('created_at'),
      supabase.from('session_members').select('session_id,user_id,role').eq('session_id', sessionId),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('session_join_requests')
        .select('id,session_id,user_id,status,created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
    ])

    if (commentsResult.error || membersResult.error || progressResult.error || requestsResult.error) {
      setScreenError(
        commentsResult.error?.message ||
          membersResult.error?.message ||
          progressResult.error?.message ||
          requestsResult.error?.message ||
          'Failed to load session details',
      )
      setLoadingSessionDetail(false)
      return
    }

    const commentsData = (commentsResult.data ?? []) as Comment[]
    const membersData = (membersResult.data ?? []) as SessionMembership[]
    const progressData = (progressResult.data ?? []) as ProgressUpdate[]
    const requestsData = (requestsResult.data ?? []) as SessionJoinRequest[]

    let likesData: CommentLike[] = []
    if (commentsData.length > 0) {
      const commentIds = commentsData.map((comment) => comment.id)
      const likesResult = await supabase
        .from('comment_likes')
        .select('id,comment_id,user_id,created_at')
        .in('comment_id', commentIds)

      if (likesResult.error) {
        setScreenError(likesResult.error.message)
        setLoadingSessionDetail(false)
        return
      }

      likesData = (likesResult.data ?? []) as CommentLike[]
    }

    const profileUserIds = Array.from(
      new Set([
        ...membersData.map((member) => member.user_id),
        ...commentsData.map((comment) => comment.user_id),
        ...requestsData.map((request) => request.user_id),
      ]),
    )

    const profileLookup: Record<string, Profile> = {}
    if (profileUserIds.length > 0) {
      const profilesResult = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', profileUserIds)

      if (profilesResult.error) {
        setScreenError(profilesResult.error.message)
        setLoadingSessionDetail(false)
        return
      }

      const profiles = (profilesResult.data ?? []) as Profile[]
      const resolvedAvatars = await resolveAvatarUrlMap(
        profiles.map((profile) => profile.avatar_url).filter((avatarUrl): avatarUrl is string => Boolean(avatarUrl)),
      )

      for (const profile of profiles) {
        profileLookup[profile.id] = profile
        if (profile.avatar_url && !isRemoteUrl(profile.avatar_url) && resolvedAvatars[profile.avatar_url]) {
          profileLookup[profile.id] = { ...profile, avatar_url: resolvedAvatars[profile.avatar_url] }
        }
      }
    }

    setSessionComments(commentsData)
    setSessionMembers(membersData)
    setSessionProgress(progressData)
    setSessionLikes(likesData)
    setSessionJoinRequests(requestsData)
    setSessionProfiles(profileLookup)
    setLoadingSessionDetail(false)
  }, [])

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        setScreenError(error.message)
      }

      if (!alive) {
        return
      }

      const activeUser = data.session?.user ?? null
      setUser(activeUser)
      setAuthLoading(false)

      if (activeUser) {
        await Promise.all([loadAppData(activeUser), loadMyProfile(activeUser)])
      }
    }

    bootstrap().catch((error: unknown) => {
      setScreenError(error instanceof Error ? error.message : 'Unexpected authentication error')
      setAuthLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null
      setUser(activeUser)
      setAuthLoading(false)
      if (activeUser) {
        Promise.all([loadAppData(activeUser), loadMyProfile(activeUser)]).catch((error: unknown) => {
          setScreenError(error instanceof Error ? error.message : 'Failed to load sessions')
        })
      } else {
        setSessions([])
        setMemberships({})
        setLatestProgress({})
        setProgressDrafts({})
        setSelectedSessionId(null)
        setSessionComments([])
        setSessionLikes([])
        setSessionMembers([])
        setSessionProgress([])
        setSessionProfiles({})
        setSessionJoinRequests([])
        setMyJoinRequestStatus({})
        setMyProfile(null)
        setProfileNameDraft('')
        setMyAvatarRenderUrl(null)
        setAvatarFile(null)
        if (avatarPreviewUrl) {
          URL.revokeObjectURL(avatarPreviewUrl)
        }
        setAvatarPreviewUrl(null)
        setAvatarInputKey((current) => current + 1)
      }
    })

    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [avatarPreviewUrl, loadAppData, loadMyProfile])

  useEffect(() => {
    const nextSelectedSessionId = getPreferredSelectedSessionId(sessions, memberships, sessionView, selectedSessionId)
    if (nextSelectedSessionId !== selectedSessionId) {
      setSelectedSessionId(nextSelectedSessionId)
    }
  }, [memberships, selectedSessionId, sessionView, sessions])

  useEffect(() => {
    if (!selectedSessionId) {
      return
    }

    loadSessionDetail(selectedSessionId).catch((error: unknown) => {
      setScreenError(error instanceof Error ? error.message : 'Failed to load session detail')
      setLoadingSessionDetail(false)
    })
  }, [loadSessionDetail, selectedSessionId])

  useEffect(() => {
    if (!user || !selectedSessionId) {
      return
    }

    const channel = supabase
      .channel(`session-live-${selectedSessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void loadSessionDetail(selectedSessionId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_updates', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void loadSessionDetail(selectedSessionId)
          void loadAppData(user)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void loadSessionDetail(selectedSessionId)
          void loadAppData(user)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        () => {
          void loadSessionDetail(selectedSessionId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_join_requests', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void loadSessionDetail(selectedSessionId)
          void loadAppData(user)
        },
      )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadAppData, loadSessionDetail, selectedSessionId, user])

  const joinedSessionCount = useMemo(
    () => sessions.filter((session) => memberships[session.id] && session.status === 'active').length,
    [sessions, memberships],
  )

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError(null)

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError(t.auth.enterEmailPassword)
      setAuthBusy(false)
      return
    }

    const response =
      authMode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword })
        : await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })

    if (response.error) {
      setAuthError(response.error.message)
      setAuthBusy(false)
      return
    }

    if (authMode === 'sign-up') {
      setAuthError(t.auth.accountCreated)
    }

    setAuthBusy(false)
  }

  async function handleSignOut() {
    setScreenError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setScreenError(error.message)
    }
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      return
    }

    if (!sessionForm.bookTitle.trim() || !sessionForm.bookAuthor.trim()) {
      setScreenError(t.sessionForm.requiredBookAuthor)
      return
    }

    setCreatingSession(true)
    setScreenError(null)

    // Ensure profile exists for the current auth user before FK insert.
    const profileUpsert = await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' })
    if (profileUpsert.error) {
      setScreenError(profileUpsert.error.message)
      setCreatingSession(false)
      return
    }

    const createResult = await supabase.rpc('create_reading_session', {
      p_book_title: sessionForm.bookTitle.trim(),
      p_book_author: sessionForm.bookAuthor.trim(),
      p_total_chapters: sessionForm.totalChapters,
      p_description: sessionForm.description.trim() || null,
      p_visibility: sessionForm.visibility,
      p_join_policy: sessionForm.joinPolicy,
    })

    if (createResult.error) {
      setScreenError(createResult.error.message)
      setCreatingSession(false)
      return
    }

    const createdSession = createResult.data as ReadingSession
    const membershipResult = await supabase.from('session_members').insert({
      session_id: createdSession.id,
      user_id: user.id,
      role: 'owner',
    })

    if (membershipResult.error) {
      setScreenError(membershipResult.error.message)
      setCreatingSession(false)
      return
    }

    setSessionForm(defaultSessionForm)
    await loadAppData(user)
    setCreatingSession(false)
  }

  async function handleJoinSession(sessionId: string) {
    if (!user) {
      return
    }

    const targetSession = sessions.find((session) => session.id === sessionId)
    if (targetSession?.join_policy === 'request') {
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
        setScreenError(error.message)
      }

      await loadAppData(user)
      if (selectedSessionId === sessionId) {
        await loadSessionDetail(sessionId)
      }
      setBusySessionId(null)
      return
    }

    setBusySessionId(sessionId)
    setScreenError(null)

    const { error } = await supabase.from('session_members').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'member',
    })

    if (error) {
      setScreenError(error.message)
      setBusySessionId(null)
      return
    }

    await loadAppData(user)
    setBusySessionId(null)
  }

  async function handleLeaveSession(sessionId: string) {
    if (!user) {
      return
    }

    setBusySessionId(sessionId)
    setScreenError(null)

    const { error } = await supabase
      .from('session_members')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      setScreenError(error.message)
      setBusySessionId(null)
      return
    }

    await loadAppData(user)
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null)
    }
    setBusySessionId(null)
  }

  async function handleArchiveSelected() {
    if (!user || !selectedSessionId) {
      return
    }

    setBusySessionId(selectedSessionId)
    const { error } = await supabase
      .from('reading_sessions')
      .update({ status: 'archived' })
      .eq('id', selectedSessionId)
      .eq('creator_id', user.id)

    if (error) {
      setScreenError(error.message)
      setBusySessionId(null)
      return
    }

    await loadAppData(user)
    if (selectedSession) {
      setSessionView('archived')
      setSelectedSessionId(selectedSession.id)
    }
    setBusySessionId(null)
  }

  async function handleRestoreSelected() {
    if (!user || !selectedSessionId) {
      return
    }

    setBusySessionId(selectedSessionId)
    const { error } = await supabase
      .from('reading_sessions')
      .update({ status: 'active' })
      .eq('id', selectedSessionId)
      .eq('creator_id', user.id)

    if (error) {
      setScreenError(error.message)
      setBusySessionId(null)
      return
    }

    await loadAppData(user)
    setSessionView('active')
    setBusySessionId(null)
  }

  async function handleApproveJoinRequest(request: SessionJoinRequest) {
    if (!selectedSessionId || !user) {
      return
    }

    setRequestBusyId(request.id)
    const updateResult = await supabase
      .from('session_join_requests')
      .update({ status: 'approved' })
      .eq('id', request.id)

    if (updateResult.error) {
      setScreenError(updateResult.error.message)
      setRequestBusyId(null)
      return
    }

    const membershipResult = await supabase.from('session_members').insert({
      session_id: selectedSessionId,
      user_id: request.user_id,
      role: 'member',
    })

    if (membershipResult.error && !membershipResult.error.message.toLowerCase().includes('duplicate')) {
      setScreenError(membershipResult.error.message)
      setRequestBusyId(null)
      return
    }

    await loadAppData(user)
    await loadSessionDetail(selectedSessionId)
    setRequestBusyId(null)
  }

  async function handleRejectJoinRequest(request: SessionJoinRequest) {
    if (!selectedSessionId || !user) {
      return
    }

    setRequestBusyId(request.id)
    const { error } = await supabase
      .from('session_join_requests')
      .update({ status: 'rejected' })
      .eq('id', request.id)

    if (error) {
      setScreenError(error.message)
      setRequestBusyId(null)
      return
    }

    await loadAppData(user)
    await loadSessionDetail(selectedSessionId)
    setRequestBusyId(null)
  }

  async function handleSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !selectedSessionId) {
      return
    }

    if (!commentDraft.trim()) {
      return
    }

    setPostingComment(true)
    setScreenError(null)
    const { error } = await supabase.from('comments').insert({
      session_id: selectedSessionId,
      user_id: user.id,
      body: commentDraft.trim(),
    })

    if (error) {
      setScreenError(error.message)
      setPostingComment(false)
      return
    }

    setCommentDraft('')
    await loadSessionDetail(selectedSessionId)
    setPostingComment(false)
  }

  async function handleToggleLike(commentId: string) {
    if (!user || !selectedSessionId) {
      return
    }

    setLikingCommentId(commentId)
    const existingLike = sessionLikes.find((like) => like.comment_id === commentId && like.user_id === user.id)

    if (existingLike) {
      const { error } = await supabase.from('comment_likes').delete().eq('id', existingLike.id)
      if (error) {
        setScreenError(error.message)
        setLikingCommentId(null)
        return
      }
    } else {
      const { error } = await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: user.id,
      })

      if (error) {
        setScreenError(error.message)
        setLikingCommentId(null)
        return
      }
    }

    await loadSessionDetail(selectedSessionId)
    setLikingCommentId(null)
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || profileSaving) {
      return
    }

    setProfileSaving(true)
    setProfileNotice(null)

    const trimmedName = profileNameDraft.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName.length > 0 ? trimmedName : null })
      .eq('id', user.id)

    if (error) {
      setScreenError(error.message)
      setProfileSaving(false)
      return
    }

    const nextProfile: Profile = {
      id: user.id,
      display_name: trimmedName.length > 0 ? trimmedName : null,
      avatar_url: myProfile?.avatar_url ?? null,
    }

    setMyProfile(nextProfile)
    setProfileNotice(t.profile.profileNameSaved)
    setProfileSaving(false)

    if (selectedSessionId) {
      await loadSessionDetail(selectedSessionId)
    }
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setProfileNotice(null)

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setScreenError(t.profile.avatarInvalidType)
      event.target.value = ''
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setScreenError(t.profile.avatarTooLarge)
      event.target.value = ''
      return
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }

    setScreenError(null)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  async function handleUploadAvatar() {
    if (!user || !avatarFile || avatarUploadBusy) {
      return
    }

    setAvatarUploadBusy(true)
    setProfileNotice(null)
    setScreenError(null)

    const extension = getAvatarExtension(avatarFile)
    const nextPath = `${user.id}/${crypto.randomUUID()}.${extension}`
    const previousPath = myProfile?.avatar_url && !isRemoteUrl(myProfile.avatar_url) ? myProfile.avatar_url : null

    const uploadResult = await supabase.storage.from(AVATAR_BUCKET).upload(nextPath, avatarFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: avatarFile.type,
    })

    if (uploadResult.error) {
      setScreenError(uploadResult.error.message)
      setAvatarUploadBusy(false)
      return
    }

    const updateResult = await supabase.from('profiles').update({ avatar_url: nextPath }).eq('id', user.id)
    if (updateResult.error) {
      setScreenError(updateResult.error.message)
      setAvatarUploadBusy(false)
      return
    }

    if (previousPath && previousPath !== nextPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
    }

    const nextRenderUrl = await resolveAvatarUrl(nextPath)
    const updatedProfile: Profile = {
      id: user.id,
      display_name: myProfile?.display_name ?? null,
      avatar_url: nextPath,
    }

    setMyProfile(updatedProfile)
    setMyAvatarRenderUrl(nextRenderUrl)
    setAvatarFile(null)
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(null)
    setAvatarInputKey((current) => current + 1)
    setProfileNotice(t.profile.avatarUpdated)
    setAvatarUploadBusy(false)

    if (selectedSessionId) {
      await loadSessionDetail(selectedSessionId)
    }
  }

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null

  const filteredSessions = useMemo(
    () => filterSessions(sessions, sessionView, visibilityFilter, sessionSearch),
    [sessionSearch, sessionView, sessions, visibilityFilter],
  )

  const activeUserId = user?.id ?? ''
  const myDisplayName = myProfile?.display_name?.trim() || user?.email || activeUserId.slice(0, 8)
  const myAvatarLabel = myProfile?.display_name || user?.email || t.auth.signedInAs
  const myAvatarImage = avatarPreviewUrl || myAvatarRenderUrl

  const selectedMembership = selectedSessionId ? memberships[selectedSessionId] : undefined
  const selectedIsMember = Boolean(selectedMembership)
  const selectedIsOwner = Boolean(selectedSession && selectedSession.creator_id === activeUserId)

  const memberLatestProgress = useMemo(() => buildLatestChapterByUser(sessionProgress), [sessionProgress])

  const commentMeta = useMemo(() => buildCommentMeta(sessionLikes, activeUserId), [activeUserId, sessionLikes])

  const pendingRequests = useMemo(
    () => sessionJoinRequests.filter((request) => request.status === 'pending'),
    [sessionJoinRequests],
  )

  async function handleUpdateProgress(session: ReadingSession) {
    if (!user) {
      return
    }

    const chapter = progressDrafts[session.id]
    if (!chapter || chapter < 1 || chapter > session.total_chapters) {
      setScreenError(t.errors.chapterRange(session.total_chapters))
      return
    }

    setBusySessionId(session.id)
    setScreenError(null)

    const { error } = await supabase.from('progress_updates').insert({
      session_id: session.id,
      user_id: user.id,
      chapter_number: chapter,
    })

    if (error) {
      setScreenError(error.message)
      setBusySessionId(null)
      return
    }

    await loadAppData(user)
    setBusySessionId(null)
  }

  if (authLoading) {
    return (
      <main className="shell">
        <section className="card centered">
          <h1>Books and Friends</h1>
          <p>{t.auth.checkingSession}</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="card auth-card">
          <div>
            <p className="eyebrow">Books and Friends</p>
            <h1>{t.auth.welcome}</h1>
            <p className="subtle">{t.auth.subtitle}</p>
          </div>

          <form className="stack" onSubmit={handleAuthSubmit}>
            <div className="auth-switch" role="tablist" aria-label={t.auth.modeAriaLabel}>
              <button
                type="button"
                className={`auth-switch-option ${authMode === 'sign-in' ? 'auth-switch-option-active' : ''}`}
                onClick={() => {
                  setAuthMode('sign-in')
                  setAuthError(null)
                }}
              >
                {t.auth.signIn}
              </button>
              <button
                type="button"
                className={`auth-switch-option ${authMode === 'sign-up' ? 'auth-switch-option-active' : ''}`}
                onClick={() => {
                  setAuthMode('sign-up')
                  setAuthError(null)
                }}
              >
                {t.auth.signUp}
              </button>
            </div>

            <label className="field">
              <span>{t.auth.email}</span>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder={t.auth.emailPlaceholder}
                autoComplete="email"
              />
            </label>

            <label className="field">
              <span>{t.auth.password}</span>
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
              />
            </label>

            {authError ? <p className="error">{authError}</p> : null}

            <button type="submit" className="primary" disabled={authBusy}>
              {authBusy ? t.common.pleaseWait : authMode === 'sign-in' ? t.auth.signIn : t.auth.createAccount}
            </button>
          </form>

          <div className="auth-switch auth-switch-corner" role="tablist" aria-label={t.language.switchLabel}>
            <button
              type="button"
              className={`auth-switch-option auth-switch-option-mini ${language === 'en' ? 'auth-switch-option-active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`auth-switch-option auth-switch-option-mini ${language === 'my' ? 'auth-switch-option-active' : ''}`}
              onClick={() => setLanguage('my')}
            >
              MY
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="shell dashboard-shell">
      <header className="card header-card">
        <div>
          <p className="eyebrow">{t.auth.welcomeBack}</p>
          <h1>Books and Friends</h1>
          <p className="subtle">{t.auth.joinedSessionsSummary(joinedSessionCount)}</p>
        </div>

        <div className="header-actions">
          <div className="auth-switch" role="tablist" aria-label={t.language.switchLabel}>
            <button
              type="button"
              className={`auth-switch-option ${language === 'en' ? 'auth-switch-option-active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              {t.language.english}
            </button>
            <button
              type="button"
              className={`auth-switch-option ${language === 'my' ? 'auth-switch-option-active' : ''}`}
              onClick={() => setLanguage('my')}
            >
              {t.language.burmese}
            </button>
          </div>

          <div className="header-identity">
            {myAvatarImage ? (
              <img className="avatar avatar-md" src={myAvatarImage} alt={`${myAvatarLabel} avatar`} />
            ) : (
              <span className="avatar avatar-md avatar-fallback" aria-hidden="true">
                {getInitials(myAvatarLabel)}
              </span>
            )}
            <div>
              <p className="subtle">{t.auth.signedInAs}</p>
              <strong>{myDisplayName}</strong>
            </div>
          </div>

          <button type="button" className="secondary" onClick={handleSignOut}>
            {t.auth.signOut}
          </button>
        </div>
      </header>

      <section className="grid">
        <article className="card stack">
          <div>
            <h2>{t.profile.title}</h2>
            <p className="subtle">{t.profile.subtitle}</p>
          </div>

          <div className="profile-card stack">
            <div className="profile-row">
              {myAvatarImage ? (
                <img className="avatar avatar-lg" src={myAvatarImage} alt={`${myAvatarLabel} avatar`} />
              ) : (
                <span className="avatar avatar-lg avatar-fallback" aria-hidden="true">
                  {getInitials(myAvatarLabel)}
                </span>
              )}
              <div className="stack gap-sm profile-upload-stack">
                <label className="field">
                  <span>{t.profile.avatarImage}</span>
                  <input
                    key={avatarInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarFileChange}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={!avatarFile || avatarUploadBusy}
                  onClick={() => {
                    void handleUploadAvatar()
                  }}
                >
                  {avatarUploadBusy ? t.common.uploading : t.profile.uploadAvatar}
                </button>
                <p className="muted">{t.profile.avatarHelp}</p>
              </div>
            </div>

            <form className="stack" onSubmit={handleSaveProfile}>
              <label className="field">
                <span>{t.profile.displayName}</span>
                <input
                  type="text"
                  value={profileNameDraft}
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                  placeholder={t.profile.displayNamePlaceholder}
                  maxLength={80}
                />
              </label>
              <button type="submit" className="primary" disabled={profileSaving}>
                {profileSaving ? t.common.saving : t.profile.saveProfile}
              </button>
            </form>

            {profileNotice ? <p className="subtle">{profileNotice}</p> : null}
          </div>

          <div>
            <h2>{t.sessionForm.title}</h2>
            <p className="subtle">{t.sessionForm.subtitle}</p>
          </div>

          <form className="stack" onSubmit={handleCreateSession}>
            <label className="field">
              <span>{t.sessionForm.bookTitle}</span>
              <input
                type="text"
                value={sessionForm.bookTitle}
                onChange={(event) => setSessionForm((current) => ({ ...current, bookTitle: event.target.value }))}
                placeholder={t.sessionForm.bookTitlePlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.author}</span>
              <input
                type="text"
                value={sessionForm.bookAuthor}
                onChange={(event) => setSessionForm((current) => ({ ...current, bookAuthor: event.target.value }))}
                placeholder={t.sessionForm.authorPlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.totalChapters}</span>
              <input
                type="number"
                min={1}
                max={999}
                value={sessionForm.totalChapters}
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    totalChapters: Number.isNaN(Number(event.target.value)) ? 1 : Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>{t.sessionForm.description}</span>
              <textarea
                value={sessionForm.description}
                onChange={(event) => setSessionForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t.sessionForm.descriptionPlaceholder}
              />
            </label>

            <div className="split">
              <label className="field">
                <span>{t.sessionForm.visibility}</span>
                <select
                  value={sessionForm.visibility}
                  onChange={(event) =>
                    setSessionForm((current) => ({
                      ...current,
                      visibility: event.target.value as 'public' | 'private',
                    }))
                  }
                >
                  <option value="public">{t.sessionForm.public}</option>
                  <option value="private">{t.sessionForm.private}</option>
                </select>
              </label>

              <label className="field">
                <span>{t.sessionForm.joinPolicy}</span>
                <select
                  value={sessionForm.joinPolicy}
                  onChange={(event) =>
                    setSessionForm((current) => ({
                      ...current,
                      joinPolicy: event.target.value as 'open' | 'request',
                    }))
                  }
                >
                  <option value="open">{t.sessionForm.openJoin}</option>
                  <option value="request">{t.sessionForm.requestRequired}</option>
                </select>
              </label>
            </div>

            <button type="submit" className="primary" disabled={creatingSession}>
              {creatingSession ? t.sessionForm.creating : t.sessionForm.createSession}
            </button>
          </form>
        </article>

        <article className="card stack">
          <div>
            <h2>{sessionView === 'active' ? t.sessions.findSessions : t.sessions.archivedSessions}</h2>
            <p className="subtle">
              {sessionView === 'active'
                ? t.sessions.activeSummary
                : t.sessions.archivedSummary}
            </p>
          </div>

          <div className="stack gap-sm">
            <div className="auth-switch" role="tablist" aria-label={t.sessions.viewAriaLabel}>
              <button
                type="button"
                className={`auth-switch-option ${sessionView === 'active' ? 'auth-switch-option-active' : ''}`}
                onClick={() => setSessionView('active')}
              >
                {t.sessions.active}
              </button>
              <button
                type="button"
                className={`auth-switch-option ${sessionView === 'archived' ? 'auth-switch-option-active' : ''}`}
                onClick={() => setSessionView('archived')}
              >
                {t.sessions.archived}
              </button>
            </div>

            <label className="field">
              <span>{t.sessions.searchLabel}</span>
              <input
                type="text"
                value={sessionSearch}
                onChange={(event) => setSessionSearch(event.target.value)}
                placeholder={t.sessions.searchPlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.sessions.visibility}</span>
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value as 'all' | 'public' | 'private')}
              >
                <option value="all">{t.sessions.all}</option>
                <option value="public">{t.enums.visibility.public}</option>
                <option value="private">{t.enums.visibility.private}</option>
              </select>
            </label>
          </div>

          {screenError ? <p className="error">{screenError}</p> : null}
          {loadingSessions ? <p className="subtle">{t.sessions.loading}</p> : null}

          {!loadingSessions && filteredSessions.length === 0 ? (
            <p className="subtle">{t.sessions.noResults}</p>
          ) : null}

          <ul className="session-list">
            {filteredSessions.map((session) => {
              const membership = memberships[session.id]
              const chapter = latestProgress[session.id] ?? 0
              const ratio = Math.min(100, Math.round((chapter / session.total_chapters) * 100))
              const isSelected = selectedSessionId === session.id
              const requestStatus = myJoinRequestStatus[session.id]

              return (
                <li key={session.id} className={`session-item ${isSelected ? 'session-item-selected' : ''}`}>
                  <div className="stack gap-sm">
                    <div className="session-heading">
                      <h3>{session.book_title}</h3>
                      <span className="pill">{t.enums.visibility[session.visibility]}</span>
                    </div>

                    <p className="subtle">{t.sessions.byAuthor(session.book_author)}</p>
                    <p className="muted">{session.description || t.sessions.noDescription}</p>

                    <div className="progress-row" aria-label={t.sessions.progressAria(session.book_title)}>
                      <div className="progress-track">
                        <span className="progress-fill" style={{ width: `${ratio}%` }} />
                      </div>
                      <span className="progress-label">{t.sessions.chapterProgress(chapter || '-', session.total_chapters)}</span>
                    </div>

                    <button
                      type="button"
                      className="tertiary"
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      {isSelected ? t.sessions.viewingDetails : t.sessions.openDetails}
                    </button>

                    {membership ? (
                      <div className="split compact">
                        <label className="field">
                          <span>{t.sessions.updateChapter}</span>
                          <input
                            type="number"
                            min={1}
                            max={session.total_chapters}
                            value={progressDrafts[session.id] ?? 1}
                            onChange={(event) =>
                              setProgressDrafts((current) => ({
                                ...current,
                                [session.id]: Number.isNaN(Number(event.target.value))
                                  ? 1
                                  : Number(event.target.value),
                              }))
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className="secondary"
                          disabled={busySessionId === session.id}
                          onClick={() => {
                            void handleUpdateProgress(session)
                          }}
                        >
                          {busySessionId === session.id ? t.common.saving : t.sessions.saveProgress}
                        </button>

                        <button
                          type="button"
                          className="ghost"
                          disabled={busySessionId === session.id || (membership.role === 'owner' && sessions.length === 1)}
                          onClick={() => {
                            void handleLeaveSession(session.id)
                          }}
                        >
                          {busySessionId === session.id ? t.common.working : t.sessions.leave}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busySessionId === session.id || session.status === 'archived' || requestStatus === 'pending'}
                        onClick={() => {
                          void handleJoinSession(session.id)
                        }}
                      >
                        {session.join_policy === 'request'
                          ? requestStatus === 'pending'
                            ? t.sessions.requestPending
                            : t.sessions.requestToJoin
                          : busySessionId === session.id
                            ? t.sessions.joining
                            : t.sessions.joinSession}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </article>

        <article className="card stack span-full">
          {!selectedSession ? (
            <p className="subtle">{t.sessions.selectSessionPrompt}</p>
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <h2>{selectedSession.book_title}</h2>
                  <p className="subtle">{t.sessions.singleThread}</p>
                </div>
                {selectedIsOwner ? (
                  <button
                    type="button"
                    className="ghost"
                    disabled={busySessionId === selectedSession.id}
                    onClick={() => {
                      if (selectedSession.status === 'active') {
                        void handleArchiveSelected()
                      } else {
                        void handleRestoreSelected()
                      }
                    }}
                  >
                    {busySessionId === selectedSession.id
                      ? selectedSession.status === 'active'
                        ? t.sessions.archiving
                        : t.sessions.restoring
                      : selectedSession.status === 'active'
                        ? t.sessions.archiveSession
                        : t.sessions.restoreSession}
                  </button>
                ) : null}
              </div>

              <div className="detail-grid">
                <section className="detail-pane stack">
                  <h3>{t.sessions.memberProgress}</h3>
                  {loadingSessionDetail ? <p className="subtle">{t.sessions.loadingDetail}</p> : null}
                  <ul className="member-list">
                    {sessionMembers.map((member) => {
                      const profile = sessionProfiles[member.user_id]
                      const chapter = memberLatestProgress[member.user_id] ?? 0
                      const ratio = Math.min(
                        100,
                        Math.round((chapter / Math.max(1, selectedSession.total_chapters)) * 100),
                      )

                      return (
                        <li key={member.user_id} className="member-item">
                          <div className="member-head">
                            <div className="identity-row">
                              {profile?.avatar_url ? (
                                <img
                                  className="avatar avatar-sm"
                                  src={profile.avatar_url}
                                  alt={`${profile.display_name || member.user_id.slice(0, 8)} avatar`}
                                />
                              ) : (
                                <span className="avatar avatar-sm avatar-fallback" aria-hidden="true">
                                  {getInitials(profile?.display_name || member.user_id.slice(0, 8))}
                                </span>
                              )}
                              <strong>{profile?.display_name || member.user_id.slice(0, 8)}</strong>
                            </div>
                            <span className="pill">{t.enums.role[member.role]}</span>
                          </div>
                          <div className="progress-track">
                            <span className="progress-fill" style={{ width: `${ratio}%` }} />
                          </div>
                          <span className="progress-label">{t.sessions.chapterProgress(chapter, selectedSession.total_chapters)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section className="detail-pane stack">
                  {selectedIsOwner ? (
                    <>
                      <h3>{t.sessions.joinRequests}</h3>
                      {pendingRequests.length === 0 ? <p className="subtle">{t.sessions.noPendingRequests}</p> : null}
                      <ul className="member-list">
                        {pendingRequests.map((request) => {
                          const profile = sessionProfiles[request.user_id]
                          return (
                            <li key={request.id} className="member-item stack gap-sm">
                              <div className="member-head">
                                <div className="identity-row">
                                  {profile?.avatar_url ? (
                                    <img
                                      className="avatar avatar-sm"
                                      src={profile.avatar_url}
                                      alt={`${profile.display_name || request.user_id.slice(0, 8)} avatar`}
                                    />
                                  ) : (
                                    <span className="avatar avatar-sm avatar-fallback" aria-hidden="true">
                                      {getInitials(profile?.display_name || request.user_id.slice(0, 8))}
                                    </span>
                                  )}
                                  <strong>{profile?.display_name || request.user_id.slice(0, 8)}</strong>
                                </div>
                                <span className="subtle">{new Date(request.created_at).toLocaleString()}</span>
                              </div>
                              <div className="split compact">
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={requestBusyId === request.id}
                                  onClick={() => {
                                    void handleApproveJoinRequest(request)
                                  }}
                                >
                                  {requestBusyId === request.id ? t.common.processing : t.sessions.approve}
                                </button>
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={requestBusyId === request.id}
                                  onClick={() => {
                                    void handleRejectJoinRequest(request)
                                  }}
                                >
                                  {t.sessions.reject}
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  ) : null}

                  <h3>{t.sessions.discussion}</h3>
                  {!selectedIsMember ? (
                    <p className="subtle">{t.sessions.joinToDiscuss}</p>
                  ) : (
                    <>
                      <form className="stack" onSubmit={handleSubmitComment}>
                        <label className="field">
                          <span>{t.sessions.yourComment}</span>
                          <textarea
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder={t.sessions.commentPlaceholder}
                          />
                        </label>
                        <button type="submit" className="primary" disabled={postingComment}>
                          {postingComment ? t.common.posting : t.sessions.postComment}
                        </button>
                      </form>

                      <ul className="comment-list">
                        {sessionComments.map((comment) => {
                          const profile = sessionProfiles[comment.user_id]
                          const likes = commentMeta.likeCounts[comment.id] ?? 0
                          const likedByMe = Boolean(commentMeta.likedByMe[comment.id])

                          return (
                            <li key={comment.id} className="comment-item">
                              <div className="comment-head">
                                <div className="identity-row">
                                  {profile?.avatar_url ? (
                                    <img
                                      className="avatar avatar-sm"
                                      src={profile.avatar_url}
                                      alt={`${profile.display_name || comment.user_id.slice(0, 8)} avatar`}
                                    />
                                  ) : (
                                    <span className="avatar avatar-sm avatar-fallback" aria-hidden="true">
                                      {getInitials(profile?.display_name || comment.user_id.slice(0, 8))}
                                    </span>
                                  )}
                                  <strong>{profile?.display_name || comment.user_id.slice(0, 8)}</strong>
                                </div>
                                <span className="subtle">{new Date(comment.created_at).toLocaleString()}</span>
                              </div>
                              <p className="comment-body">{comment.is_deleted ? t.sessions.deleted : comment.body}</p>
                              <button
                                type="button"
                                className={`like-button ${likedByMe ? 'like-button-active' : ''}`}
                                disabled={likingCommentId === comment.id}
                                onClick={() => {
                                  void handleToggleLike(comment.id)
                                }}
                              >
                                {likingCommentId === comment.id ? t.common.updating : likedByMe ? t.sessions.liked(likes) : t.sessions.like(likes)}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
