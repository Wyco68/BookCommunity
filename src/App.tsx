import { useEffect, useState, useCallback, useMemo } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { supabase } from './lib/supabase'
import { translations } from './i18n'
import { useSessionDerivedState } from './hooks/useSessionDerivedState'
import { filterSessions } from './lib/sessionState'
import { useAuth } from './hooks/useAuth'
import { useSessions, defaultSessionForm } from './hooks/useSessions'
import { useProfile } from './hooks/useProfile'
import { AppRouter } from './router/AppRouter'
import { AuthLoadingView, AuthView } from './components/AuthView'
import './App.css'

function App() {
  const auth = useAuth()
  const sessions = useSessions()
  const profile = useProfile()
  const t = translations[auth.language]

  // ── Stable-ref destructuring for exhaustive-deps compliance ──────────────
  // useState setters are guaranteed stable by React.
  // useCallback([]) / useCallback([stableRef]) functions are stable across renders.
  const { setError: authSetError, setUser: authSetUser, setLoading: authSetLoading } = auth
  const { mode: authMode, signIn: authSignIn, signUp: authSignUp } = auth
  const {
    loadSessions,
    refreshSessions,
    createSession,
    setSessions,
    setMemberships,
    setLatestProgress,
    setProgressDrafts,
    setMyJoinRequestStatus,
    setSessionCategoryNames,
    setSessionFirstMedia,
    setSessionUploadedChapterCount,
    setSessionReadChaptersByUsers,
  } = sessions
  const {
    loadProfile,
    setProfile: profileSetData,
    setNameDraft: profileSetNameDraft,
    setNotice: profileSetNotice,
    setAvatarInputKey: profileSetAvatarInputKey,
    setAvatarPreviewUrl: profileSetAvatarPreviewUrl,
  } = profile
  // ─────────────────────────────────────────────────────────────────────────

  const [sessionSearch, setSessionSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [sessionForm, setSessionForm] = useState(defaultSessionForm)

  const activeUserId = auth.user?.id ?? ''
  const {
    filteredSessions,
  } = useSessionDerivedState({
    activeUserId,
    sessions: sessions.sessions,
    memberships: sessions.memberships,
    selectedSessionId: null,
    sessionProgress: [],
    sessionLikes: [],
    sessionJoinRequests: [],
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

  // Home: ALL joined ongoing sessions — isolated from search/visibility state
  const joinedFilteredSessions = useMemo(
    () =>
      sessions.sessions.filter(
        (session) =>
          session.status_type === 'ongoing' && Boolean(sessions.memberships[session.id]),
      ),
    [sessions.sessions, sessions.memberships],
  )

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        authSetError(error.message)
      }

      if (!alive) {
        return
      }

      const activeUser = data.session?.user ?? null
      authSetUser(activeUser)
      authSetLoading(false)

      if (activeUser) {
        await Promise.all([
          loadSessions(activeUser),
          loadProfile(activeUser.id),
        ])
      }
    }

    bootstrap().catch((error: unknown) => {
      authSetError(error instanceof Error ? error.message : 'Unexpected authentication error')
      authSetLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null
      authSetUser(activeUser)
      authSetLoading(false)
      if (activeUser) {
        Promise.all([loadSessions(activeUser), loadProfile(activeUser.id)]).catch((error: unknown) => {
          authSetError(error instanceof Error ? error.message : 'Failed to load sessions')
        })
      } else {
        setSessions([])
        setMemberships({})
        setLatestProgress({})
        setProgressDrafts({})
        setMyJoinRequestStatus({})
        setSessionCategoryNames({})
        setSessionFirstMedia({})
        setSessionUploadedChapterCount({})
        setSessionReadChaptersByUsers({})
        profileSetData(null)
        profileSetNameDraft('')
        profileSetNotice(null)
        profileSetAvatarInputKey(0)
        profileSetAvatarPreviewUrl(null)
      }
    })

    return () => {
      alive = false
      authListener.subscription.unsubscribe()
    }
  }, [
    authSetError, authSetUser, authSetLoading,
    loadSessions, loadProfile,
    setSessions, setMemberships, setLatestProgress, setProgressDrafts,
    setMyJoinRequestStatus, setSessionCategoryNames, setSessionFirstMedia,
    setSessionUploadedChapterCount, setSessionReadChaptersByUsers,
    profileSetData, profileSetNameDraft, profileSetNotice,
    profileSetAvatarInputKey, profileSetAvatarPreviewUrl,
  ])

  // Refetch sessions when user returns to the tab / window
  useEffect(() => {
    if (!auth.user) return

    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshSessions()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [auth.user, refreshSessions])

  const handleAuthSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (authMode === 'sign-in') {
      void authSignIn()
    } else {
      void authSignUp()
    }
  }, [authMode, authSignIn, authSignUp])

  const handleCreateSession = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth.user) {
      return Promise.resolve()
    }
    return createSession(auth.user, sessionForm).then(() => {
      setSessionForm(defaultSessionForm)
    })
  }, [auth.user, sessionForm, createSession])

  const handleJoinSession = useCallback(async (sessionId: string) => {
    if (!auth.user) {
      return
    }
    await sessions.joinSession(sessionId, auth.user)
  }, [auth.user, sessions])

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
    selectedSessionId: null as string | null,
    myJoinRequestStatus: sessions.myJoinRequestStatus,
    progressDrafts: sessions.progressDrafts,
    busySessionId: sessions.busySessionId,
    sessionCategoryNames: sessions.sessionCategoryNames,
    sessionFirstMedia: sessions.sessionFirstMedia,
    sessionUploadedChapterCount: sessions.sessionUploadedChapterCount,
    latestProgress: sessions.latestProgress,
    sessionReadChaptersByUsers: sessions.sessionReadChaptersByUsers,
    onSessionSearchChange: setSessionSearch,
    onVisibilityFilterChange: setVisibilityFilter,
    onSelectSession: () => {},
    onJoinSession: handleJoinSession,
  }

  const searchListProps = {
    ...listPanelProps,
    filteredSessions: combinedSearchSessions,
    hasMore: sessions.hasMore,
    loadingMore: sessions.loadingMore,
    onLoadMore: sessions.loadMoreSessions,
  }

  const sectionsListProps = {
    ...listPanelProps,
    filteredSessions: joinedFilteredSessions,
    sessionSearch: '',
    onSessionSearchChange: () => {},
    onVisibilityFilterChange: () => {},
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
    avatarFile: profile.avatarFile,
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
        return profile.uploadAvatar(auth.user.id)
      }
      return Promise.resolve()
    },
    onProfileNameDraftChange: profile.setNameDraft,
    onSaveProfile: () => {
      if (auth.user) {
        return profile.saveProfile(auth.user.id)
      }
      return Promise.resolve()
    },
    onSignOut: auth.signOut,
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
  }

  return (
    <AppRouter
      headerProps={headerProps}
      profileEditProps={profileEditProps}
      searchSectionProps={searchSectionProps}
      sectionsAndDetailsProps={sectionsAndDetailsProps}
      userId={activeUserId}
      onSessionDeleted={sessions.removeSession}
    />
  )
}

export default App