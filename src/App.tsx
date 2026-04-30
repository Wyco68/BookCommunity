import { useEffect, useState, useCallback, useMemo } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { supabase } from './lib/supabase'
import { translations } from './i18n'
import { useSessionDerivedState } from './hooks/useSessionDerivedState'
import { filterSessions, getPreferredSelectedSessionId } from './lib/sessionState'
import { useMediaUpload } from './hooks/useMediaUpload'
import { useAuth } from './hooks/useAuth'
import { useSessions, defaultSessionForm } from './hooks/useSessions'
import { useSessionDetail } from './hooks/useSessionDetail'
import { useProfile } from './hooks/useProfile'
import { AppRouter } from './router/AppRouter'
import { AuthLoadingView, AuthView } from './components/AuthView'
import type { ReadingSession, SessionJoinRequest } from './types'
import './App.css'

export type { SessionFormState } from './hooks/useSessions'
export { defaultSessionForm } from './hooks/useSessions'

function App() {
  const auth = useAuth()
  const sessions = useSessions()
  const detail = useSessionDetail()
  const profile = useProfile()
  const t = translations[auth.language]

  const [sessionSearch, setSessionSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [sessionForm, setSessionForm] = useState(defaultSessionForm)

  const sessionMedia = useMediaUpload({
    sessionId: selectedSessionId,
    userId: auth.user?.id ?? null,
  })

  const activeUserId = auth.user?.id ?? ''
  const {
    selectedSession,
    filteredSessions,
    selectedIsMember,
    selectedIsOwner,
    memberLatestProgress,
    commentMeta,
    pendingRequests,
  } = useSessionDerivedState({
    activeUserId,
    sessions: sessions.sessions,
    memberships: sessions.memberships,
    selectedSessionId,
    sessionProgress: detail.progress,
    sessionLikes: detail.likes,
    sessionJoinRequests: detail.joinRequests,
    visibilityFilter,
    sessionSearch,
  })

  const searchFilteredSessions = useMemo(
    () => filterSessions(sessions.sessions, visibilityFilter, sessionSearch).filter(
      (session) => !sessions.memberships[session.id],
    ),
    [sessions.sessions, sessions.memberships, visibilityFilter, sessionSearch],
  )

  const joinedSearchSessions = useMemo(
    () => filterSessions(sessions.sessions, visibilityFilter, sessionSearch).filter(
      (session) => Boolean(sessions.memberships[session.id]),
    ),
    [sessions.sessions, sessions.memberships, visibilityFilter, sessionSearch],
  )

  const combinedSearchSessions = useMemo(
    () => [...searchFilteredSessions, ...joinedSearchSessions],
    [searchFilteredSessions, joinedSearchSessions],
  )

  const joinedFilteredSessions = useMemo(
    () => filteredSessions.filter((session) => Boolean(sessions.memberships[session.id])),
    [filteredSessions, sessions.memberships],
  )

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        auth.setError(error.message)
      }

      if (!alive) {
        return
      }

      const activeUser = data.session?.user ?? null
      auth.setUser(activeUser)
      auth.setLoading(false)

      if (activeUser) {
        await Promise.all([
          sessions.loadSessions(activeUser),
          profile.loadProfile(activeUser.id),
        ])
      }
    }

    bootstrap().catch((error: unknown) => {
      auth.setError(error instanceof Error ? error.message : 'Unexpected authentication error')
      auth.setLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null
      auth.setUser(activeUser)
      auth.setLoading(false)
      if (activeUser) {
        Promise.all([sessions.loadSessions(activeUser), profile.loadProfile(activeUser.id)]).catch((error: unknown) => {
          auth.setError(error instanceof Error ? error.message : 'Failed to load sessions')
        })
      } else {
        sessions.setSessions([])
        sessions.setMemberships({})
        sessions.setLatestProgress({})
        sessions.setProgressDrafts({})
        setSelectedSessionId(null)
        detail.clearDetail()
        sessions.setMyJoinRequestStatus({})
        profile.setProfile(null)
        profile.setNameDraft('')
        profile.setNotice(null)
        profile.setAvatarInputKey(0)
      }
    })

    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const nextSelectedSessionId = getPreferredSelectedSessionId(sessions.sessions, sessions.memberships, selectedSessionId)
    if (nextSelectedSessionId !== selectedSessionId) {
      setSelectedSessionId(nextSelectedSessionId)
    }
  }, [sessions.memberships, selectedSessionId, sessions.sessions])

  useEffect(() => {
    if (!selectedSessionId) {
      return
    }

    detail.loadDetail(selectedSessionId).catch((error: unknown) => {
      auth.setError(error instanceof Error ? error.message : 'Failed to load session detail')
    })

    void sessionMedia.loadMedia()
  }, [selectedSessionId])

  useEffect(() => {
    if (!auth.user || !selectedSessionId) {
      return
    }

    const channel = supabase
      .channel(`session-live-${selectedSessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void detail.loadDetail(selectedSessionId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_updates', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void detail.loadDetail(selectedSessionId)
          void sessions.loadSessions(auth.user!)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void detail.loadDetail(selectedSessionId)
          void sessions.loadSessions(auth.user!)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        () => {
          void detail.loadDetail(selectedSessionId)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_join_requests', filter: `session_id=eq.${selectedSessionId}` },
        () => {
          void detail.loadDetail(selectedSessionId)
          void sessions.loadSessions(auth.user!)
        },
      )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [auth.user, selectedSessionId])

  const handleAuthSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (auth.mode === 'sign-in') {
      void auth.signIn()
    } else {
      void auth.signUp()
    }
  }, [auth.mode])

  const handleCreateSession = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth.user) {
      return Promise.resolve()
    }
    return sessions.createSession(auth.user, sessionForm).then(() => {
      setSessionForm(defaultSessionForm)
    })
  }, [auth.user, sessionForm])

  const handleJoinSession = useCallback(async (sessionId: string) => {
    if (!auth.user) {
      return
    }
    await sessions.joinSession(sessionId, auth.user)
  }, [auth.user, sessions])

  const handleLeaveSession = useCallback(async (sessionId: string) => {
    if (!auth.user) {
      return
    }
    await sessions.leaveSession(sessionId, auth.user)
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null)
    }
  }, [auth.user, sessions, selectedSessionId])

  const handleUpdateProgress = useCallback(async (session: ReadingSession) => {
    if (!auth.user) {
      return
    }
    const chapter = sessions.progressDrafts[session.id]
    await sessions.updateProgress(session, chapter, auth.user)
  }, [auth.user, sessions])

  const handleSubmitComment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth.user || !selectedSessionId) {
      return
    }
    if (!commentDraft.trim()) {
      return
    }
    await detail.submitComment(selectedSessionId, auth.user.id, commentDraft)
    setCommentDraft('')
  }, [auth.user, selectedSessionId, commentDraft, detail])

  const handleToggleLike = useCallback(async (commentId: string) => {
    if (!auth.user || !selectedSessionId) {
      return
    }
    await detail.toggleLike(selectedSessionId, auth.user.id, commentId)
  }, [auth.user, selectedSessionId, detail])

  const handleApproveJoinRequest = useCallback(async (request: SessionJoinRequest) => {
    if (!selectedSessionId || !auth.user) {
      return
    }
    await detail.approveRequest(selectedSessionId, request)
  }, [selectedSessionId, auth.user, detail])

  const handleRejectJoinRequest = useCallback(async (request: SessionJoinRequest) => {
    if (!selectedSessionId || !auth.user) {
      return
    }
    await detail.rejectRequest(selectedSessionId, request)
  }, [selectedSessionId, auth.user, detail])

  if (auth.loading) {
    return <AuthLoadingView message={t.auth.checkingSession} />
  }

  if (!auth.user) {
    return (
      <AuthView
        t={t}
        language={auth.language}
        authMode={auth.mode}
        authEmail={auth.email}
        authPassword={auth.password}
        authError={auth.error}
        authBusy={auth.busy}
        onSubmit={handleAuthSubmit}
        onAuthModeChange={(mode) => {
          auth.setMode(mode)
          auth.setEmail('')
          auth.setPassword('')
        }}
        onAuthEmailChange={auth.setEmail}
        onAuthPasswordChange={auth.setPassword}
        onLanguageChange={auth.setLanguage}
      />
    )
  }

  const listPanelProps = {
    t,
    sessionSearch,
    visibilityFilter,
    screenError: sessions.error,
    loadingSessions: sessions.loading,
    filteredSessions,
    memberships: sessions.memberships,
    latestProgress: sessions.latestProgress,
    selectedSessionId,
    myJoinRequestStatus: sessions.myJoinRequestStatus,
    progressDrafts: sessions.progressDrafts,
    busySessionId: sessions.busySessionId,
    totalSessionCount: sessions.sessions.length,
    onSessionSearchChange: setSessionSearch,
    onVisibilityFilterChange: setVisibilityFilter,
    onSelectSession: setSelectedSessionId,
    onProgressDraftsChange: sessions.setProgressDrafts,
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
    loadingSessionDetail: detail.loading,
    sessionMembers: detail.members,
    sessionProfiles: detail.profiles,
    memberLatestProgress,
    pendingRequests,
    requestBusyId: null,
    commentDraft,
    postingComment: false,
    sessionComments: detail.comments,
    commentMeta,
    likingCommentId: null,
    onApproveJoinRequest: handleApproveJoinRequest,
    onRejectJoinRequest: handleRejectJoinRequest,
    onSubmitComment: handleSubmitComment,
    onCommentDraftChange: setCommentDraft,
    onToggleLike: handleToggleLike,
    media: sessionMedia.media,
    mediaUrls: sessionMedia.mediaUrls,
    mediaLoading: sessionMedia.loading,
    mediaUploading: sessionMedia.uploading,
    mediaError: sessionMedia.error,
    mediaHasMore: sessionMedia.hasMore,
    onUploadMedia: sessionMedia.uploadMedia,
    onRemoveMedia: sessionMedia.removeMedia,
    onLoadMoreMedia: sessionMedia.loadMore,
    currentUserId: activeUserId,
  }

  const headerProps = {
    t,
    language: auth.language,
    myAvatarImage: profile.avatarPreviewUrl,
    myAvatarLabel: profile.profile?.display_name || auth.user?.email || t.auth.signedInAs,
    myDisplayName: profile.profile?.display_name?.trim() || auth.user?.email || activeUserId.slice(0, 8),
    onLanguageChange: auth.setLanguage,
    onSignOut: auth.signOut,
  }

  const profileEditProps = {
    t,
    myAvatarImage: profile.avatarPreviewUrl,
    myAvatarLabel: profile.profile?.display_name || auth.user?.email || t.auth.signedInAs,
    avatarInputKey: profile.avatarInputKey,
    avatarFile: null,
    avatarUploadBusy: profile.uploading,
    profileNameDraft: profile.nameDraft,
    profileSaving: profile.saving,
    profileNotice: profile.notice,
    onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        profile.handleAvatarFile(file)
      }
    },
    onUploadAvatar: () => {
      if (auth.user) {
        profile.uploadAvatar(auth.user.id)
      }
      return Promise.resolve()
    },
    onProfileNameDraftChange: profile.setNameDraft,
    onSaveProfile: () => {
      if (auth.user) {
        profile.saveProfile(auth.user.id)
      }
      return Promise.resolve()
    },
  }

  const searchSectionProps = {
    t,
    listProps: searchListProps as never,
    sessionForm,
    creatingSession: sessions.creating,
    onSessionFormChange: setSessionForm,
    onCreateSession: handleCreateSession,
  }

  const sectionsAndDetailsProps = {
    t,
    listProps: sectionsListProps as never,
    detailProps: detailPanelProps as never,
  }

  return (
    <AppRouter
      headerProps={headerProps}
      profileEditProps={profileEditProps}
      searchSectionProps={searchSectionProps}
      sectionsAndDetailsProps={sectionsAndDetailsProps}
      userId={activeUserId}
    />
  )
}

export default App