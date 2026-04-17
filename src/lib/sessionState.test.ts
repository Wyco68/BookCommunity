import { describe, expect, it } from 'vitest'
import type { CommentLike, ProgressUpdate, ReadingSession, SessionMembership } from '../types'
import {
  buildCommentMeta,
  buildLatestChapterByUser,
  filterSessions,
  getPreferredSelectedSessionId,
} from './sessionState'

function makeSession(
  id: string,
  status: 'active' | 'archived',
  visibility: 'public' | 'private',
  title: string,
  author: string,
): ReadingSession {
  return {
    id,
    creator_id: 'owner-1',
    book_title: title,
    book_author: author,
    total_chapters: 10,
    description: null,
    visibility,
    join_policy: 'open',
    status,
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('getPreferredSelectedSessionId', () => {
  it('keeps currently selected session when it still exists', () => {
    const sessions = [
      makeSession('s1', 'active', 'public', 'A', 'Author A'),
      makeSession('s2', 'active', 'public', 'B', 'Author B'),
    ]

    const memberships: Record<string, SessionMembership> = {}
    const selected = getPreferredSelectedSessionId(sessions, memberships, 'active', 's2')

    expect(selected).toBe('s2')
  })

  it('returns null for empty session list', () => {
    const selected = getPreferredSelectedSessionId([], {}, 'active', null)
    expect(selected).toBeNull()
  })

  it('prefers joined session in the current view when selection is missing', () => {
    const sessions = [
      makeSession('s1', 'archived', 'public', 'Old', 'Author A'),
      makeSession('s2', 'active', 'public', 'Active One', 'Author B'),
      makeSession('s3', 'active', 'public', 'Active Two', 'Author C'),
    ]
    const memberships: Record<string, SessionMembership> = {
      s3: { session_id: 's3', user_id: 'u1', role: 'member' },
    }

    const selected = getPreferredSelectedSessionId(sessions, memberships, 'active', 'missing')
    expect(selected).toBe('s3')
  })

  it('falls back to first session in current view when user is not a member of any', () => {
    const sessions = [
      makeSession('s1', 'archived', 'public', 'Old', 'Author A'),
      makeSession('s2', 'active', 'public', 'Active One', 'Author B'),
      makeSession('s3', 'active', 'public', 'Active Two', 'Author C'),
    ]

    const selected = getPreferredSelectedSessionId(sessions, {}, 'active', null)
    expect(selected).toBe('s2')
  })
})

describe('filterSessions', () => {
  const sessions = [
    makeSession('s1', 'active', 'public', 'The Alchemist', 'Paulo Coelho'),
    makeSession('s2', 'active', 'private', 'Dune', 'Frank Herbert'),
    makeSession('s3', 'archived', 'public', 'Clean Code', 'Robert Martin'),
  ]

  it('returns happy path match by title', () => {
    const result = filterSessions(sessions, 'active', 'all', 'dune')
    expect(result.map((session) => session.id)).toEqual(['s2'])
  })

  it('handles leading and trailing whitespace in search query', () => {
    const result = filterSessions(sessions, 'active', 'all', '  alchemist  ')
    expect(result.map((session) => session.id)).toEqual(['s1'])
  })

  it('applies visibility and status filters together', () => {
    const result = filterSessions(sessions, 'active', 'public', '')
    expect(result.map((session) => session.id)).toEqual(['s1'])
  })

  it('matches by author name in a case-insensitive way', () => {
    const result = filterSessions(sessions, 'active', 'all', 'frank HERBERT')
    expect(result.map((session) => session.id)).toEqual(['s2'])
  })

  it('returns empty list when no session matches search and filters', () => {
    const result = filterSessions(sessions, 'active', 'private', 'alchemist')
    expect(result).toEqual([])
  })
})

describe('buildLatestChapterByUser', () => {
  it('uses first update per user as latest when input is newest-first', () => {
    const updates: ProgressUpdate[] = [
      { session_id: 's1', user_id: 'u1', chapter_number: 8, created_at: '2026-01-03' },
      { session_id: 's1', user_id: 'u2', chapter_number: 4, created_at: '2026-01-03' },
      { session_id: 's1', user_id: 'u1', chapter_number: 3, created_at: '2026-01-01' },
    ]

    expect(buildLatestChapterByUser(updates)).toEqual({ u1: 8, u2: 4 })
  })

  it('uses created_at ordering when updates arrive out of order', () => {
    const updates: ProgressUpdate[] = [
      { session_id: 's1', user_id: 'u1', chapter_number: 3, created_at: '2026-01-01T00:00:00.000Z' },
      { session_id: 's1', user_id: 'u1', chapter_number: 8, created_at: '2026-01-03T00:00:00.000Z' },
      { session_id: 's1', user_id: 'u2', chapter_number: 1, created_at: '2026-01-01T00:00:00.000Z' },
      { session_id: 's1', user_id: 'u2', chapter_number: 5, created_at: '2026-01-02T00:00:00.000Z' },
    ]

    expect(buildLatestChapterByUser(updates)).toEqual({ u1: 8, u2: 5 })
  })

  it('uses the later encountered update for ties on created_at', () => {
    const updates: ProgressUpdate[] = [
      { session_id: 's1', user_id: 'u1', chapter_number: 4, created_at: '2026-01-01T00:00:00.000Z' },
      { session_id: 's1', user_id: 'u1', chapter_number: 6, created_at: '2026-01-01T00:00:00.000Z' },
    ]

    expect(buildLatestChapterByUser(updates)).toEqual({ u1: 6 })
  })

  it('returns empty lookup for empty updates', () => {
    expect(buildLatestChapterByUser([])).toEqual({})
  })
})

describe('buildCommentMeta', () => {
  it('builds like counts and current-user like map', () => {
    const likes: CommentLike[] = [
      { id: 'l1', comment_id: 'c1', user_id: 'u1', created_at: '2026-01-01' },
      { id: 'l2', comment_id: 'c1', user_id: 'u2', created_at: '2026-01-01' },
      { id: 'l3', comment_id: 'c2', user_id: 'u1', created_at: '2026-01-01' },
    ]

    const meta = buildCommentMeta(likes, 'u1')
    expect(meta.likeCounts).toEqual({ c1: 2, c2: 1 })
    expect(meta.likedByMe).toEqual({ c1: true, c2: true })
  })

  it('returns empty maps for no likes', () => {
    expect(buildCommentMeta([], 'u1')).toEqual({ likeCounts: {}, likedByMe: {} })
  })
})