import { useMemo } from 'react'
import type {
  CommentLike,
  ProgressUpdate,
  ReadingSession,
  SessionJoinRequest,
  SessionMembership,
} from '../types'
import { buildCommentMeta, buildLatestChapterByUser, filterSessions } from '../lib/sessionState'

interface UseSessionDerivedStateInput {
  activeUserId: string
  sessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  selectedSessionId: string | null
  sessionProgress: ProgressUpdate[]
  sessionLikes: CommentLike[]
  sessionJoinRequests: SessionJoinRequest[]
  visibilityFilter: 'all' | 'public' | 'private'
  sessionSearch: string
}

export function useSessionDerivedState({
  activeUserId,
  sessions,
  memberships,
  selectedSessionId,
  sessionProgress,
  sessionLikes,
  sessionJoinRequests,
  visibilityFilter,
  sessionSearch,
}: UseSessionDerivedStateInput) {
  const joinedSessionCount = useMemo(
    () => sessions.filter((session) => memberships[session.id] && session.status === 'active').length,
    [sessions, memberships],
  )

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  )

  const filteredSessions = useMemo(
    () => filterSessions(sessions, visibilityFilter, sessionSearch),
    [sessions, visibilityFilter, sessionSearch],
  )

  const selectedMembership = selectedSessionId ? memberships[selectedSessionId] : undefined
  const selectedIsMember = Boolean(selectedMembership)
  const selectedIsOwner = Boolean(selectedSession && selectedSession.creator_id === activeUserId)

  const memberLatestProgress = useMemo(() => buildLatestChapterByUser(sessionProgress), [sessionProgress])
  const commentMeta = useMemo(() => buildCommentMeta(sessionLikes, activeUserId), [activeUserId, sessionLikes])
  const pendingRequests = useMemo(
    () => sessionJoinRequests.filter((request) => request.status === 'pending'),
    [sessionJoinRequests],
  )

  return {
    joinedSessionCount,
    selectedSession,
    filteredSessions,
    selectedMembership,
    selectedIsMember,
    selectedIsOwner,
    memberLatestProgress,
    commentMeta,
    pendingRequests,
  }
}
