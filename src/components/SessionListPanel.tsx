import { memo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { JoinSessionModal } from './JoinSessionModal'
import { SessionCard } from './SessionCard'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { ReadingSession, SessionCardMediaPreview, SessionJoinRequest, SessionMembership } from '../types'
import { useMotion } from '../hooks/useMotion'

type Copy = (typeof translations)[Language]

export interface SessionListPanelProps {
  t: Copy
  sessionSearch: string
  visibilityFilter: 'all' | 'public' | 'private'
  screenError: string | null
  loadingSessions: boolean
  filteredSessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  selectedSessionId: string | null
  myJoinRequestStatus: Record<string, SessionJoinRequest['status']>
  busySessionId: string | null
  sessionCategoryNames: Record<string, string[]>
  sessionFirstMedia: Record<string, SessionCardMediaPreview>
  sessionUploadedChapterCount: Record<string, number>
  latestProgress: Record<string, number>
  sessionReadChaptersByUsers?: Record<string, number>
  onSessionSearchChange: (value: string) => void
  onVisibilityFilterChange: (value: 'all' | 'public' | 'private') => void
  onSelectSession: (sessionId: string) => void
  onJoinSession: (sessionId: string) => Promise<void>
  showControls?: boolean
  embedded?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export const SessionListPanel = memo(function SessionListPanel({
  t,
  sessionSearch,
  visibilityFilter,
  screenError,
  loadingSessions,
  filteredSessions,
  memberships,
  myJoinRequestStatus,
  busySessionId,
  sessionCategoryNames,
  sessionFirstMedia,
  sessionUploadedChapterCount,
  latestProgress,
  onSessionSearchChange,
  onVisibilityFilterChange,
  onJoinSession,
  showControls = true,
  embedded = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: SessionListPanelProps) {
  const navigate = useNavigate()
  const canAnimate = useMotion()
  const [joinTarget, setJoinTarget] = useState<ReadingSession | null>(null)

  const handleConfirmJoin = useCallback(async () => {
    if (!joinTarget) return
    await onJoinSession(joinTarget.id)
    navigate(`/session/${joinTarget.id}`)
    setJoinTarget(null)
  }, [joinTarget, onJoinSession, navigate])

  const rootClassName = embedded ? 'stack session-panel-embedded' : 'card stack'
  const RootTag = embedded ? 'div' : 'article'

  return (
    <RootTag className={rootClassName}>
      {showControls ? (
        <div className="stack gap-sm">
          <input
            type="text"
            value={sessionSearch}
            onChange={(event) => onSessionSearchChange(event.target.value)}
            placeholder={t.sessions.searchPlaceholder}
            aria-label={t.sessions.searchLabel}
          />

          <select
            value={visibilityFilter}
            onChange={(event) => onVisibilityFilterChange(event.target.value as 'all' | 'public' | 'private')}
            aria-label={t.sessions.visibility}
          >
            <option value="all">{t.sessions.all}</option>
            <option value="public">{t.enums.visibility.public}</option>
            <option value="private">{t.enums.visibility.private}</option>
          </select>
        </div>
      ) : null}

      {screenError ? <p className="error">{screenError}</p> : null}
      {loadingSessions ? (
        <ul className="session-list session-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="session-item session-card session-card-fixed skeleton-shimmer" style={{ height: '240px' }} />
          ))}
        </ul>
      ) : null}
      {!loadingSessions && filteredSessions.length === 0 ? <p className="subtle">{t.sessions.noResults}</p> : null}

      <ul className="session-list session-grid">
        {filteredSessions.map((session, index) => {
          const membership = memberships[session.id]
          const requestStatus = myJoinRequestStatus[session.id]
          const categories = sessionCategoryNames[session.id] ?? []
          const firstMedia = sessionFirstMedia[session.id]
          const myProgress = latestProgress[session.id] ?? 0
          const uploadedCount = sessionUploadedChapterCount[session.id] ?? 0
          const coverUrl = firstMedia?.is_image ? firstMedia.signed_url : null

          return (
            <SessionCard
              key={session.id}
              className={canAnimate ? 'animate-fade-in' : ''}
              style={canAnimate ? { animationDelay: `${index * 50}ms`, opacity: 0 } : undefined}
              t={t}
              session={session}
              membership={membership}
              requestStatus={requestStatus}
              categories={categories}
              coverUrl={coverUrl}
              myProgress={myProgress}
              uploadedCount={uploadedCount}
              busy={busySessionId === session.id}
              onClick={() => {
                if (membership) {
                  navigate(`/session/${session.id}`)
                } else if (requestStatus !== 'pending') {
                  setJoinTarget(session)
                }
              }}
              onJoinClick={!membership ? () => setJoinTarget(session) : undefined}
            />
          )
        })}
      </ul>

      {onLoadMore && hasMore ? (
        <div className="load-more-row">
          <button
            type="button"
            className="secondary"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? t.sessions.loadingMore : t.sessions.loadMore}
          </button>
        </div>
      ) : null}

      {joinTarget ? (
        <JoinSessionModal
          session={joinTarget}
          loading={busySessionId === joinTarget.id}
          onConfirm={() => { void handleConfirmJoin() }}
          onCancel={() => setJoinTarget(null)}
          titleLabel={t.sessions.joinModalTitle}
          descOpen={t.sessions.joinModalDescOpen}
          descRequest={t.sessions.joinModalDescRequest}
          confirmLabel={joinTarget.join_policy === 'request' ? t.sessions.requestToJoin : t.sessions.joinSession}
          cancelLabel={t.common.cancel}
        />
      ) : null}
    </RootTag>
  )
})
