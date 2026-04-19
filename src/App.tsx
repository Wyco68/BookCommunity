import { useCallback, useEffect, useState } from 'react'
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
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  getAvatarExtension,
  isRemoteUrl,
  resolveAvatarUrl,
  resolveAvatarUrlMap,
} from './lib/avatar'
import { AuthLoadingView, AuthView } from './components/AuthView'
import { useSessionDerivedState } from './hooks/useSessionDerivedState'
import {
  buildJoinRequestStatusLookup,
  buildLatestProgressBySession,
  buildMembershipLookup,
} from './lib/sessionData'
import { filterSessions, getPreferredSelectedSessionId } from './lib/sessionState'
import { AppRouter } from './router/AppRouter'
import './App.css'

type AuthMode = 'sign-in' | 'sign-up'

export interface SessionFormState {
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

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

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
      supabase.from('reading_sessions').select('*').eq('status', 'active').order('created_at', { ascending: false }),
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

    const membershipLookup = buildMembershipLookup((membershipsResult.data ?? []) as SessionMembership[])
    const progressLookup = buildLatestProgressBySession((progressResult.data ?? []) as ProgressUpdate[])
    const requestLookup = buildJoinRequestStatusLookup((requestsResult.data ?? []) as SessionJoinRequest[])

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
    const nextSelectedSessionId = getPreferredSelectedSessionId(sessions, memberships, selectedSessionId)
    if (nextSelectedSessionId !== selectedSessionId) {
      setSelectedSessionId(nextSelectedSessionId)
    }
  }, [memberships, selectedSessionId, sessions])

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

  const activeUserId = user?.id ?? ''
  const myDisplayName = myProfile?.display_name?.trim() || user?.email || activeUserId.slice(0, 8)
  const myAvatarLabel = myProfile?.display_name || user?.email || t.auth.signedInAs
  const myAvatarImage = avatarPreviewUrl || myAvatarRenderUrl
  const {
    joinedSessionCount,
    selectedSession,
    filteredSessions,
    selectedIsMember,
    selectedIsOwner,
    memberLatestProgress,
    commentMeta,
    pendingRequests,
  } = useSessionDerivedState({
    activeUserId,
    sessions,
    memberships,
    selectedSessionId,
    sessionProgress,
    sessionLikes,
    sessionJoinRequests,
    visibilityFilter,
    sessionSearch,
  })

  const searchFilteredSessions = filterSessions(sessions, visibilityFilter, sessionSearch).filter(
    (session) => !memberships[session.id],
  )
  const joinedSearchSessions = filterSessions(sessions, visibilityFilter, sessionSearch).filter(
    (session) => Boolean(memberships[session.id]),
  )
  const combinedSearchSessions = [...searchFilteredSessions, ...joinedSearchSessions]
  const joinedFilteredSessions = filteredSessions.filter((session) => Boolean(memberships[session.id]))

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
    return <AuthLoadingView message={t.auth.checkingSession} />
  }

  if (!user) {
    return (
      <AuthView
        t={t}
        language={language}
        authMode={authMode}
        authEmail={authEmail}
        authPassword={authPassword}
        authError={authError}
        authBusy={authBusy}
        onSubmit={handleAuthSubmit}
        onAuthModeChange={(mode) => {
          setAuthMode(mode)
          setAuthError(null)
        }}
        onAuthEmailChange={setAuthEmail}
        onAuthPasswordChange={setAuthPassword}
        onLanguageChange={setLanguage}
      />
    )
  }

  const listPanelProps = {
    t,
    sessionSearch,
    visibilityFilter,
    screenError,
    loadingSessions,
    filteredSessions,
    memberships,
    latestProgress,
    selectedSessionId,
    myJoinRequestStatus,
    progressDrafts,
    busySessionId,
    totalSessionCount: sessions.length,
    onSessionSearchChange: setSessionSearch,
    onVisibilityFilterChange: setVisibilityFilter,
    onSelectSession: setSelectedSessionId,
    onProgressDraftsChange: setProgressDrafts,
    onUpdateProgress: handleUpdateProgress,
    onLeaveSession: handleLeaveSession,
    onJoinSession: handleJoinSession,
  }

  const searchListProps = {
    ...listPanelProps,
    filteredSessions: combinedSearchSessions,
  }

  const sectionsListProps = {
    ...listPanelProps,
    filteredSessions: joinedFilteredSessions,
    sessionSearch: '',
    onSessionSearchChange: () => {},
    onVisibilityFilterChange: () => {},
  }

  const detailPanelProps = {
    t,
    selectedSession,
    selectedIsOwner,
    selectedIsMember,
    loadingSessionDetail,
    sessionMembers,
    sessionProfiles,
    memberLatestProgress,
    pendingRequests,
    requestBusyId,
    commentDraft,
    postingComment,
    sessionComments,
    commentMeta,
    likingCommentId,
    onApproveJoinRequest: handleApproveJoinRequest,
    onRejectJoinRequest: handleRejectJoinRequest,
    onSubmitComment: handleSubmitComment,
    onCommentDraftChange: setCommentDraft,
    onToggleLike: handleToggleLike,
  }

  return (
    <AppRouter
      headerProps={{
        t,
        language,
        joinedSessionCount,
        myAvatarImage,
        myAvatarLabel,
        myDisplayName,
        onLanguageChange: setLanguage,
        onSignOut: handleSignOut,
      }}
      profileEditProps={{
        t,
        myAvatarImage,
        myAvatarLabel,
        avatarInputKey,
        avatarFile,
        avatarUploadBusy,
        profileNameDraft,
        profileSaving,
        profileNotice,
        onAvatarFileChange: handleAvatarFileChange,
        onUploadAvatar: handleUploadAvatar,
        onProfileNameDraftChange: setProfileNameDraft,
        onSaveProfile: handleSaveProfile,
      }}
      searchSectionProps={{
        t,
        listProps: searchListProps,
        sessionForm,
        creatingSession,
        onSessionFormChange: setSessionForm,
        onCreateSession: handleCreateSession,
      }}
      sectionsAndDetailsProps={{
        t,
        listProps: sectionsListProps,
        detailProps: detailPanelProps,
      }}
    />
  )
}

export default App
