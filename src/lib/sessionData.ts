import type { ProgressUpdate, SessionJoinRequest, SessionMembership } from '../types'

export function buildMembershipLookup(memberships: SessionMembership[]): Record<string, SessionMembership> {
  const lookup: Record<string, SessionMembership> = {}
  for (const membership of memberships) {
    lookup[membership.session_id] = membership
  }
  return lookup
}

export function buildLatestProgressBySession(progressUpdates: ProgressUpdate[]): Record<string, number> {
  const lookup: Record<string, number> = {}
  for (const update of progressUpdates) {
    if (!(update.session_id in lookup)) {
      lookup[update.session_id] = update.chapter_number
    }
  }
  return lookup
}

export function buildJoinRequestStatusLookup(
  requests: SessionJoinRequest[],
): Record<string, SessionJoinRequest['status']> {
  const lookup: Record<string, SessionJoinRequest['status']> = {}
  for (const request of requests) {
    lookup[request.session_id] = request.status
  }
  return lookup
}