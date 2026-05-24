import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Routes, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { translations } from './i18n'
import type { Language } from './i18n'
import { useSessionDerivedState } from './hooks/useSessionDerivedState'
import { filterSessions } from './lib/sessionState'
import { useSessions, defaultSessionForm } from './hooks/useSessions'
import { useProfile } from './hooks/useProfile'
import { buildAuthenticatedBranch } from './router/AppRouter'
import { supabase } from './lib/supabase'
import { APP_PATHS } from './router/paths'
import { AuthLoadingView } from './components/AuthView'

interface AuthenticatedAppProps {
  user: User
  language: Language
  setLanguage: (lang: Language) => void
}

export default function AuthenticatedApp({ user, language, setLanguage }: AuthenticatedAppProps) {
  const navigate = useNavigate()
  const sessions = useSessions()
  const profile = useProfile()
  const t = translations[language]

  const {
    loadSessions,
    refreshSessions,
    createSession,
    removeSession,
  } = sessions
  const { loadProfile } = profile

  const hydratedUserIdRef = useRef<string | null>(null)

  const hydrateUserData = useCallback(
    (activeUser: User) => {
      if (hydratedUserIdRef.current === activeUser.id) {
        return Promise.resolve()
      }
      hydratedUserIdRef.current = activeUser.id
      return Promise.all([loadSessions(activeUser), loadProfile(activeUser.id)])
    },
    [loadSessions, loadProfile],
  )

  const signOutToLogin = useCallback(async () => {
    hydratedUserIdRef.current = null
    await supabase.auth.signOut()
    navigate(APP_PATHS.login, { replace: true })
  }, [navigate])

  const [sessionSearch, setSessionSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all')
  const [sessionForm, setSessionForm] = useState(defaultSessionForm)

  const activeUserId = user.id

  const { filteredSessions } = useSessionDerivedState({
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

  const joinedFilteredSessions = useMemo(
    () =>
      sessions.sessions.filter(
        (session) =>
          session.status_type === 'ongoing' && Boolean(sessions.memberships[session.id]),
      ),
    [sessions.sessions, sessions.memberships],
  )

  useEffect(() => {
    void hydrateUserData(user)
  }, [user, hydrateUserData])

  useEffect(() => {
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
  }, [refreshSessions])

  const handleCreateSession = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    return createSession(user, sessionForm).then(() => {
      setSessionForm(defaultSessionForm)
    })
  }, [user, sessionForm, createSession])

  const handleJoinSession = useCallback(
    async (sessionId: string) => {
      await sessions.joinSession(sessionId, user)
    },
    [user, sessions],
  )

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
    language,
    myAvatarImage: profile.avatarPreviewUrl,
    myAvatarLabel: profile.profile?.display_name || user.email || t.auth.signedInAs,
    myDisplayName: profile.profile?.display_name?.trim() || user.email || activeUserId.slice(0, 8),
    onLanguageChange: setLanguage,
    onSignOut: signOutToLogin,
  }

  const profileEditProps = {
    t,
    myAvatarImage: profile.avatarPreviewUrl,
    myAvatarLabel: profile.profile?.display_name || user.email || t.auth.signedInAs,
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
    onUploadAvatar: () => profile.uploadAvatar(user.id),
    onProfileNameDraftChange: profile.setNameDraft,
    onSaveProfile: () => profile.saveProfile(user.id),
    onSignOut: signOutToLogin,
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
    allSessions: sessions.sessions,
  }

  return (
    <Suspense fallback={<AuthLoadingView message={t.common.loading} />}>
      <Routes>
        {buildAuthenticatedBranch({
          headerProps,
          profileEditProps,
          searchSectionProps,
          sectionsAndDetailsProps,
          userId: activeUserId,
          onSessionDeleted: removeSession,
        })}
      </Routes>
    </Suspense>
  )
}
