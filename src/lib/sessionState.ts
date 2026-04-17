import type { CommentLike, ProgressUpdate, ReadingSession, SessionMembership } from '../types'

export function getPreferredSelectedSessionId(
  sessions: ReadingSession[],
  memberships: Record<string, SessionMembership>,
  sessionView: 'active' | 'archived',
  selectedSessionId: string | null,
): string | null {
  if (sessions.length === 0) {
    return null
  }

  if (selectedSessionId && sessions.some((session) => session.id === selectedSessionId)) {
    return selectedSessionId
  }

  const joinedSession = sessions.find((session) => memberships[session.id] && session.status === sessionView)
  const firstInView = sessions.find((session) => session.status === sessionView)
  return joinedSession?.id ?? firstInView?.id ?? sessions[0]?.id ?? null
}

export function filterSessions(
  sessions: ReadingSession[],
  sessionView: 'active' | 'archived',
  visibilityFilter: 'all' | 'public' | 'private',
  sessionSearch: string,
): ReadingSession[] {
  const query = sessionSearch.trim().toLowerCase()

  return sessions.filter((session) => {
    if (session.status !== sessionView) {
      return false
    }

    if (visibilityFilter !== 'all' && session.visibility !== visibilityFilter) {
      return false
    }

    if (!query) {
      return true
    }

    return session.book_title.toLowerCase().includes(query) || session.book_author.toLowerCase().includes(query)
  })
}

export function buildLatestChapterByUser(progressUpdates: ProgressUpdate[]): Record<string, number> {
  const latestCreatedAtByUser: Record<string, number> = {}
  const lookup: Record<string, number> = {}
  for (const update of progressUpdates) {
    const createdAtMs = Date.parse(update.created_at)
    const createdAt = Number.isNaN(createdAtMs) ? Number.NEGATIVE_INFINITY : createdAtMs
    if (!(update.user_id in lookup) || createdAt >= (latestCreatedAtByUser[update.user_id] ?? Number.NEGATIVE_INFINITY)) {
      latestCreatedAtByUser[update.user_id] = createdAt
      lookup[update.user_id] = update.chapter_number
    }
  }
  return lookup
}

export function buildCommentMeta(sessionLikes: CommentLike[], activeUserId: string): {
  likeCounts: Record<string, number>
  likedByMe: Record<string, boolean>
} {
  const likeCounts: Record<string, number> = {}
  const likedByMe: Record<string, boolean> = {}

  for (const like of sessionLikes) {
    likeCounts[like.comment_id] = (likeCounts[like.comment_id] ?? 0) + 1
    if (like.user_id === activeUserId) {
      likedByMe[like.comment_id] = true
    }
  }

  return { likeCounts, likedByMe }
}