import { describe, expect, it } from 'vitest'
import type { ProgressUpdate, SessionJoinRequest, SessionMembership } from '../types'
import {
  buildJoinRequestStatusLookup,
  buildLatestProgressBySession,
  buildMembershipLookup,
} from './sessionData'

describe('buildMembershipLookup', () => {
  it('maps each session id to its membership record', () => {
    const memberships: SessionMembership[] = [
      { session_id: 's1', user_id: 'u1', role: 'member' },
      { session_id: 's2', user_id: 'u1', role: 'owner' },
    ]

    expect(buildMembershipLookup(memberships)).toEqual({
      s1: memberships[0],
      s2: memberships[1],
    })
  })

  it('returns empty lookup for empty memberships', () => {
    expect(buildMembershipLookup([])).toEqual({})
  })
})

describe('buildLatestProgressBySession', () => {
  it('uses first update for each session with newest-first input', () => {
    const progress: ProgressUpdate[] = [
      { session_id: 's1', user_id: 'u1', chapter_number: 7, created_at: '2026-01-03' },
      { session_id: 's1', user_id: 'u1', chapter_number: 3, created_at: '2026-01-01' },
      { session_id: 's2', user_id: 'u1', chapter_number: 2, created_at: '2026-01-03' },
    ]

    expect(buildLatestProgressBySession(progress)).toEqual({ s1: 7, s2: 2 })
  })

  it('returns empty lookup for empty progress', () => {
    expect(buildLatestProgressBySession([])).toEqual({})
  })
})

describe('buildJoinRequestStatusLookup', () => {
  it('maps each session id to the latest status in ordered input', () => {
    const requests: SessionJoinRequest[] = [
      { id: 'r1', session_id: 's1', user_id: 'u1', status: 'approved', created_at: '2026-01-03' },
      { id: 'r2', session_id: 's2', user_id: 'u1', status: 'pending', created_at: '2026-01-02' },
    ]

    expect(buildJoinRequestStatusLookup(requests)).toEqual({ s1: 'approved', s2: 'pending' })
  })

  it('returns empty lookup for empty requests', () => {
    expect(buildJoinRequestStatusLookup([])).toEqual({})
  })
})
