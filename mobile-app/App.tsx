import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { User } from '@supabase/supabase-js'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './src/lib/supabase'
import type {
  Comment,
  CommentLike,
  Profile,
  ProgressUpdate,
  ReadingSession,
  SessionJoinRequest,
  SessionMembership,
} from './src/types'

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

function labelForProfile(userId: string, profiles: Record<string, Profile>): string {
  return profiles[userId]?.display_name?.trim() || userId.slice(0, 8)
}

function ActionButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string
  onPress: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant !== 'primary' && styles.buttonTextSecondary,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
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
  const [profileNotice, setProfileNotice] = useState<string | null>(null)

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

    if (sessionsResult.error || membershipsResult.error || progressResult.error || requestsResult.error) {
      setScreenError(
        sessionsResult.error?.message ||
          membershipsResult.error?.message ||
          progressResult.error?.message ||
          requestsResult.error?.message ||
          'Failed to load data',
      )
      setLoadingSessions(false)
      return
    }

    const membershipLookup: Record<string, SessionMembership> = {}
    for (const membership of (membershipsResult.data ?? []) as SessionMembership[]) {
      membershipLookup[membership.session_id] = membership
    }

    const progressLookup: Record<string, number> = {}
    for (const update of (progressResult.data ?? []) as ProgressUpdate[]) {
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
    setMyProfile(profile)
    setProfileNameDraft(profile.display_name ?? '')
  }, [])

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
    const requestsData = (requestsResult.data ?? []) as SessionJoinRequest[]

    let likesData: CommentLike[] = []
    if (commentsData.length > 0) {
      const likesResult = await supabase
        .from('comment_likes')
        .select('id,comment_id,user_id,created_at')
        .in('comment_id', commentsData.map((item) => item.id))

      if (likesResult.error) {
        setScreenError(likesResult.error.message)
        setLoadingSessionDetail(false)
        return
      }

      likesData = (likesResult.data ?? []) as CommentLike[]
    }

    const profileUserIds = Array.from(
      new Set([
        ...membersData.map((item) => item.user_id),
        ...commentsData.map((item) => item.user_id),
        ...requestsData.map((item) => item.user_id),
      ]),
    )

    const profileLookup: Record<string, Profile> = {}
    if (profileUserIds.length > 0) {
      const profilesResult = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', profileUserIds)

      if (profilesResult.error) {
        setScreenError(profilesResult.error.message)
        setLoadingSessionDetail(false)
        return
      }

      for (const profile of (profilesResult.data ?? []) as Profile[]) {
        profileLookup[profile.id] = profile
      }
    }

    setSessionComments(commentsData)
    setSessionMembers(membersData)
    setSessionProgress((progressResult.data ?? []) as ProgressUpdate[])
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
      setScreenError(error instanceof Error ? error.message : 'Unexpected auth error')
      setAuthLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null
      setUser(activeUser)
      setAuthLoading(false)

      if (!activeUser) {
        setSessions([])
        setMemberships({})
        setLatestProgress({})
        setProgressDrafts({})
        setMyJoinRequestStatus({})
        setSelectedSessionId(null)
        setSessionComments([])
        setSessionLikes([])
        setSessionMembers([])
        setSessionProgress([])
        setSessionProfiles({})
        setSessionJoinRequests([])
        setMyProfile(null)
        setProfileNameDraft('')
        return
      }

      Promise.all([loadAppData(activeUser), loadMyProfile(activeUser)]).catch((error: unknown) => {
        setScreenError(error instanceof Error ? error.message : 'Failed to load app data')
      })
    })

    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [loadAppData, loadMyProfile])

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null)
      return
    }

    if (selectedSessionId && sessions.some((item) => item.id === selectedSessionId)) {
      return
    }

    const joinedSession = sessions.find((item) => memberships[item.id] && item.status === sessionView)
    const firstInView = sessions.find((item) => item.status === sessionView)
    setSelectedSessionId(joinedSession?.id ?? firstInView?.id ?? sessions[0]?.id ?? null)
  }, [memberships, selectedSessionId, sessionView, sessions])

  useEffect(() => {
    if (!selectedSessionId) {
      return
    }

    loadSessionDetail(selectedSessionId).catch((error: unknown) => {
      setScreenError(error instanceof Error ? error.message : 'Failed to load details')
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

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  )

  const activeUserId = user?.id ?? ''
  const selectedMembership = selectedSessionId ? memberships[selectedSessionId] : undefined
  const selectedIsMember = Boolean(selectedMembership)
  const selectedIsOwner = Boolean(selectedSession && selectedSession.creator_id === activeUserId)

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (session.status !== sessionView) {
        return false
      }

      if (visibilityFilter !== 'all' && session.visibility !== visibilityFilter) {
        return false
      }

      if (!sessionSearch.trim()) {
        return true
      }

      const query = sessionSearch.toLowerCase()
      return session.book_title.toLowerCase().includes(query) || session.book_author.toLowerCase().includes(query)
    })
  }, [sessionSearch, sessionView, sessions, visibilityFilter])

  const joinedSessionCount = useMemo(
    () => sessions.filter((session) => memberships[session.id] && session.status === 'active').length,
    [memberships, sessions],
  )

  const memberLatestProgress = useMemo(() => {
    const lookup: Record<string, number> = {}
    for (const update of sessionProgress) {
      if (!(update.user_id in lookup)) {
        lookup[update.user_id] = update.chapter_number
      }
    }
    return lookup
  }, [sessionProgress])

  const pendingRequests = useMemo(
    () => sessionJoinRequests.filter((request) => request.status === 'pending'),
    [sessionJoinRequests],
  )

  const commentMeta = useMemo(() => {
    const likeCounts: Record<string, number> = {}
    const likedByMe: Record<string, boolean> = {}

    for (const like of sessionLikes) {
      likeCounts[like.comment_id] = (likeCounts[like.comment_id] ?? 0) + 1
      if (like.user_id === activeUserId) {
        likedByMe[like.comment_id] = true
      }
    }

    return { likeCounts, likedByMe }
  }, [activeUserId, sessionLikes])

  async function handleAuthSubmit() {
    setAuthBusy(true)
    setAuthError(null)

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter email and password.')
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
      setAuthError('Account created. Confirm email if required by project settings.')
    }

    setAuthBusy(false)
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setScreenError(error.message)
    }
  }

  async function handleCreateSession() {
    if (!user) {
      return
    }

    if (!sessionForm.bookTitle.trim() || !sessionForm.bookAuthor.trim()) {
      setScreenError('Book title and author are required.')
      return
    }

    setCreatingSession(true)
    setScreenError(null)

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
    const { error } = await supabase.from('session_members').delete().eq('session_id', sessionId).eq('user_id', user.id)

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

  async function handleUpdateProgress(session: ReadingSession) {
    if (!user) {
      return
    }

    const chapter = progressDrafts[session.id]
    if (!chapter || chapter < 1 || chapter > session.total_chapters) {
      setScreenError(`Chapter must be between 1 and ${session.total_chapters}.`)
      return
    }

    setBusySessionId(session.id)
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

  async function handleArchiveSelected() {
    if (!user || !selectedSessionId || !selectedSession) {
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
    setSessionView('archived')
    setSelectedSessionId(selectedSession.id)
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
    const updateResult = await supabase.from('session_join_requests').update({ status: 'approved' }).eq('id', request.id)

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
    const { error } = await supabase.from('session_join_requests').update({ status: 'rejected' }).eq('id', request.id)

    if (error) {
      setScreenError(error.message)
      setRequestBusyId(null)
      return
    }

    await loadAppData(user)
    await loadSessionDetail(selectedSessionId)
    setRequestBusyId(null)
  }

  async function handleSubmitComment() {
    if (!user || !selectedSessionId || !commentDraft.trim()) {
      return
    }

    setPostingComment(true)
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

  async function handleSaveProfile() {
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

    setMyProfile({
      id: user.id,
      display_name: trimmedName.length > 0 ? trimmedName : null,
      avatar_url: myProfile?.avatar_url ?? null,
    })
    setProfileNotice('Profile saved.')
    setProfileSaving(false)

    if (selectedSessionId) {
      await loadSessionDetail(selectedSessionId)
    }
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2a5bd7" />
          <Text style={styles.subtle}>Checking your session...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.authCard}>
          <Text style={styles.title}>Books and Friends</Text>
          <Text style={styles.subtle}>Sign in to continue.</Text>

          <View style={styles.segmentedRow}>
            <ActionButton title="Sign in" onPress={() => setAuthMode('sign-in')} variant={authMode === 'sign-in' ? 'primary' : 'secondary'} />
            <ActionButton title="Sign up" onPress={() => setAuthMode('sign-up')} variant={authMode === 'sign-up' ? 'primary' : 'secondary'} />
          </View>

          <TextInput
            style={styles.input}
            value={authEmail}
            onChangeText={setAuthEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={authPassword}
            onChangeText={setAuthPassword}
            placeholder="Password"
            secureTextEntry
          />

          {authError ? <Text style={styles.error}>{authError}</Text> : null}

          <ActionButton
            title={authBusy ? 'Please wait...' : authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            onPress={() => {
              void handleAuthSubmit()
            }}
            disabled={authBusy}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Books and Friends</Text>
          <Text style={styles.subtle}>{joinedSessionCount} active joined sessions</Text>
          <Text style={styles.subtle}>Signed in as {myProfile?.display_name?.trim() || user.email || user.id.slice(0, 8)}</Text>
          <ActionButton title="Sign out" onPress={() => void handleSignOut()} variant="ghost" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <TextInput
            style={styles.input}
            value={profileNameDraft}
            onChangeText={setProfileNameDraft}
            placeholder="Display name"
            maxLength={80}
          />
          <ActionButton
            title={profileSaving ? 'Saving...' : 'Save profile'}
            onPress={() => {
              void handleSaveProfile()
            }}
            disabled={profileSaving}
          />
          {profileNotice ? <Text style={styles.subtle}>{profileNotice}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Create Session</Text>
          <TextInput
            style={styles.input}
            value={sessionForm.bookTitle}
            onChangeText={(value) => setSessionForm((current) => ({ ...current, bookTitle: value }))}
            placeholder="Book title"
          />
          <TextInput
            style={styles.input}
            value={sessionForm.bookAuthor}
            onChangeText={(value) => setSessionForm((current) => ({ ...current, bookAuthor: value }))}
            placeholder="Author"
          />
          <TextInput
            style={styles.input}
            value={String(sessionForm.totalChapters)}
            onChangeText={(value) =>
              setSessionForm((current) => ({
                ...current,
                totalChapters: Number.isNaN(Number(value)) ? 1 : Math.max(1, Number(value)),
              }))
            }
            placeholder="Total chapters"
            keyboardType="number-pad"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={sessionForm.description}
            onChangeText={(value) => setSessionForm((current) => ({ ...current, description: value }))}
            placeholder="Description"
            multiline
          />

          <Text style={styles.smallLabel}>Visibility</Text>
          <View style={styles.segmentedRow}>
            <ActionButton
              title="Public"
              onPress={() => setSessionForm((current) => ({ ...current, visibility: 'public' }))}
              variant={sessionForm.visibility === 'public' ? 'primary' : 'secondary'}
            />
            <ActionButton
              title="Private"
              onPress={() => setSessionForm((current) => ({ ...current, visibility: 'private' }))}
              variant={sessionForm.visibility === 'private' ? 'primary' : 'secondary'}
            />
          </View>

          <Text style={styles.smallLabel}>Join Policy</Text>
          <View style={styles.segmentedRow}>
            <ActionButton
              title="Open"
              onPress={() => setSessionForm((current) => ({ ...current, joinPolicy: 'open' }))}
              variant={sessionForm.joinPolicy === 'open' ? 'primary' : 'secondary'}
            />
            <ActionButton
              title="Request"
              onPress={() => setSessionForm((current) => ({ ...current, joinPolicy: 'request' }))}
              variant={sessionForm.joinPolicy === 'request' ? 'primary' : 'secondary'}
            />
          </View>

          <ActionButton
            title={creatingSession ? 'Creating...' : 'Create session'}
            onPress={() => {
              void handleCreateSession()
            }}
            disabled={creatingSession}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Find Sessions</Text>
          <View style={styles.segmentedRow}>
            <ActionButton
              title="Active"
              onPress={() => setSessionView('active')}
              variant={sessionView === 'active' ? 'primary' : 'secondary'}
            />
            <ActionButton
              title="Archived"
              onPress={() => setSessionView('archived')}
              variant={sessionView === 'archived' ? 'primary' : 'secondary'}
            />
          </View>

          <TextInput
            style={styles.input}
            value={sessionSearch}
            onChangeText={setSessionSearch}
            placeholder="Search title or author"
          />

          <Text style={styles.smallLabel}>Visibility filter</Text>
          <View style={styles.segmentedWrap}>
            <ActionButton
              title="All"
              onPress={() => setVisibilityFilter('all')}
              variant={visibilityFilter === 'all' ? 'primary' : 'secondary'}
            />
            <ActionButton
              title="Public"
              onPress={() => setVisibilityFilter('public')}
              variant={visibilityFilter === 'public' ? 'primary' : 'secondary'}
            />
            <ActionButton
              title="Private"
              onPress={() => setVisibilityFilter('private')}
              variant={visibilityFilter === 'private' ? 'primary' : 'secondary'}
            />
          </View>

          {screenError ? <Text style={styles.error}>{screenError}</Text> : null}
          {loadingSessions ? <ActivityIndicator color="#2a5bd7" /> : null}

          {filteredSessions.map((session) => {
            const membership = memberships[session.id]
            const chapter = latestProgress[session.id] ?? 0
            const progressRatio = Math.min(1, chapter / Math.max(1, session.total_chapters))
            const requestStatus = myJoinRequestStatus[session.id]
            const isSelected = selectedSessionId === session.id

            return (
              <View key={session.id} style={[styles.sessionCard, isSelected && styles.sessionCardSelected]}>
                <Text style={styles.sessionTitle}>{session.book_title}</Text>
                <Text style={styles.subtle}>by {session.book_author}</Text>
                <Text style={styles.subtle}>Visibility: {session.visibility} | Join: {session.join_policy}</Text>
                <Text style={styles.subtle}>{session.description || 'No description yet.'}</Text>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
                </View>
                <Text style={styles.subtle}>Chapter {chapter || '-'} / {session.total_chapters}</Text>

                <ActionButton
                  title={isSelected ? 'Viewing details' : 'Open details'}
                  onPress={() => setSelectedSessionId(session.id)}
                  variant="ghost"
                />

                {membership ? (
                  <>
                    <TextInput
                      style={styles.input}
                      value={String(progressDrafts[session.id] ?? 1)}
                      onChangeText={(value) =>
                        setProgressDrafts((current) => ({
                          ...current,
                          [session.id]: Number.isNaN(Number(value)) ? 1 : Math.max(1, Number(value)),
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="Current chapter"
                    />
                    <ActionButton
                      title={busySessionId === session.id ? 'Saving...' : 'Save progress'}
                      onPress={() => {
                        void handleUpdateProgress(session)
                      }}
                      disabled={busySessionId === session.id}
                      variant="secondary"
                    />
                    <ActionButton
                      title={busySessionId === session.id ? 'Working...' : 'Leave'}
                      onPress={() => {
                        void handleLeaveSession(session.id)
                      }}
                      disabled={busySessionId === session.id}
                      variant="ghost"
                    />
                  </>
                ) : (
                  <ActionButton
                    title={
                      session.join_policy === 'request'
                        ? requestStatus === 'pending'
                          ? 'Request pending'
                          : 'Request to join'
                        : busySessionId === session.id
                          ? 'Joining...'
                          : 'Join session'
                    }
                    onPress={() => {
                      void handleJoinSession(session.id)
                    }}
                    disabled={busySessionId === session.id || session.status === 'archived' || requestStatus === 'pending'}
                    variant="secondary"
                  />
                )}
              </View>
            )
          })}

          {!loadingSessions && filteredSessions.length === 0 ? <Text style={styles.subtle}>No sessions found.</Text> : null}
        </View>

        <View style={styles.card}>
          {!selectedSession ? (
            <Text style={styles.subtle}>Select a session to see details and discussion.</Text>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{selectedSession.book_title}</Text>
              <Text style={styles.subtle}>Single-thread discussion and member progress</Text>

              {selectedIsOwner ? (
                <ActionButton
                  title={
                    busySessionId === selectedSession.id
                      ? selectedSession.status === 'active'
                        ? 'Archiving...'
                        : 'Restoring...'
                      : selectedSession.status === 'active'
                        ? 'Archive session'
                        : 'Restore session'
                  }
                  onPress={() => {
                    if (selectedSession.status === 'active') {
                      void handleArchiveSelected()
                    } else {
                      void handleRestoreSelected()
                    }
                  }}
                  disabled={busySessionId === selectedSession.id}
                  variant="ghost"
                />
              ) : null}

              <Text style={styles.sectionTitle}>Member Progress</Text>
              {loadingSessionDetail ? <ActivityIndicator color="#2a5bd7" /> : null}
              {sessionMembers.map((member) => {
                const chapter = memberLatestProgress[member.user_id] ?? 0
                const ratio = Math.min(1, chapter / Math.max(1, selectedSession.total_chapters))
                const name = labelForProfile(member.user_id, sessionProfiles)

                return (
                  <View key={member.user_id} style={styles.memberCard}>
                    <Text style={styles.memberTitle}>{name} ({member.role})</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
                    </View>
                    <Text style={styles.subtle}>Chapter {chapter} / {selectedSession.total_chapters}</Text>
                  </View>
                )
              })}

              {selectedIsOwner ? (
                <>
                  <Text style={styles.sectionTitle}>Join Requests</Text>
                  {pendingRequests.length === 0 ? <Text style={styles.subtle}>No pending requests.</Text> : null}
                  {pendingRequests.map((request) => {
                    const requester = labelForProfile(request.user_id, sessionProfiles)
                    return (
                      <View key={request.id} style={styles.memberCard}>
                        <Text style={styles.memberTitle}>{requester}</Text>
                        <Text style={styles.subtle}>{new Date(request.created_at).toLocaleString()}</Text>
                        <ActionButton
                          title={requestBusyId === request.id ? 'Processing...' : 'Approve'}
                          onPress={() => {
                            void handleApproveJoinRequest(request)
                          }}
                          disabled={requestBusyId === request.id}
                          variant="secondary"
                        />
                        <ActionButton
                          title="Reject"
                          onPress={() => {
                            void handleRejectJoinRequest(request)
                          }}
                          disabled={requestBusyId === request.id}
                          variant="ghost"
                        />
                      </View>
                    )
                  })}
                </>
              ) : null}

              <Text style={styles.sectionTitle}>Discussion</Text>
              {!selectedIsMember ? (
                <Text style={styles.subtle}>Join this session to read and post comments.</Text>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="Share your thoughts..."
                    multiline
                  />
                  <ActionButton
                    title={postingComment ? 'Posting...' : 'Post comment'}
                    onPress={() => {
                      void handleSubmitComment()
                    }}
                    disabled={postingComment}
                  />

                  {sessionComments.map((comment) => {
                    const likes = commentMeta.likeCounts[comment.id] ?? 0
                    const likedByMe = Boolean(commentMeta.likedByMe[comment.id])
                    const author = labelForProfile(comment.user_id, sessionProfiles)

                    return (
                      <View key={comment.id} style={styles.commentCard}>
                        <Text style={styles.memberTitle}>{author}</Text>
                        <Text style={styles.subtle}>{new Date(comment.created_at).toLocaleString()}</Text>
                        <Text style={styles.commentBody}>{comment.is_deleted ? '[deleted]' : comment.body}</Text>
                        <ActionButton
                          title={
                            likingCommentId === comment.id
                              ? 'Updating...'
                              : likedByMe
                                ? `Liked (${likes})`
                                : `Like (${likes})`
                          }
                          onPress={() => {
                            void handleToggleLike(comment.id)
                          }}
                          disabled={likingCommentId === comment.id}
                          variant={likedByMe ? 'primary' : 'secondary'}
                        />
                      </View>
                    )
                  })}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  content: {
    padding: 14,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  authCard: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    gap: 10,
    borderColor: '#e4e7f1',
    borderWidth: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderColor: '#e4e7f1',
    borderWidth: 1,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#102046',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102046',
  },
  subtle: {
    color: '#4f5f84',
    fontSize: 14,
  },
  error: {
    color: '#b21f2d',
    fontSize: 14,
  },
  smallLabel: {
    color: '#334166',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  input: {
    borderColor: '#c8d0e3',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fbfcff',
    color: '#1c2f56',
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: '#2a5bd7',
  },
  buttonSecondary: {
    backgroundColor: '#e6edff',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#c8d0e3',
    backgroundColor: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: '#ffffff',
  },
  buttonTextSecondary: {
    color: '#1d3468',
  },
  sessionCard: {
    borderColor: '#d8e0f3',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  sessionCardSelected: {
    borderColor: '#2a5bd7',
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102046',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#e9edf7',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2a5bd7',
  },
  memberCard: {
    borderColor: '#d8e0f3',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 7,
  },
  memberTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#102046',
  },
  commentCard: {
    borderColor: '#d8e0f3',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 7,
  },
  commentBody: {
    color: '#1f3159',
    fontSize: 14,
  },
})
