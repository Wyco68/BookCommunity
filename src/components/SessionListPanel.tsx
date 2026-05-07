import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../types'

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
  sessionReadChaptersByUsers?: Record<string, number>
  onSessionSearchChange: (value: string) => void
  onVisibilityFilterChange: (value: 'all' | 'public' | 'private') => void
  onSelectSession: (sessionId: string) => void
  onJoinSession: (sessionId: string) => Promise<void>
  showControls?: boolean
  /** Flat panel inside a parent card (e.g. Search results); no outer card or duplicate title */
  embedded?: boolean
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
  sessionReadChaptersByUsers = {},
  onSessionSearchChange,
  onVisibilityFilterChange,
  onJoinSession,
  showControls = true,
  embedded = false,
}: SessionListPanelProps) {
  const navigate = useNavigate()

  const rootClassName = embedded ? 'stack session-panel-embedded' : 'card stack'
  const RootTag = embedded ? 'div' : 'article'

  return (
    <RootTag className={rootClassName}>
      {embedded && !showControls ? null : (
        <div>
          <h2>{t.sessions.findSessions}</h2>
          <p className="subtle">{t.sessions.activeSummary}</p>
        </div>
      )}

      {showControls ? (
        <div className="stack gap-sm">
          <label className="field">
            <span>{t.sessions.searchLabel}</span>
            <input
              type="text"
              value={sessionSearch}
              onChange={(event) => onSessionSearchChange(event.target.value)}
              placeholder={t.sessions.searchPlaceholder}
            />
          </label>

          <label className="field">
            <span>{t.sessions.visibility}</span>
            <select
              value={visibilityFilter}
              onChange={(event) => onVisibilityFilterChange(event.target.value as 'all' | 'public' | 'private')}
            >
              <option value="all">{t.sessions.all}</option>
              <option value="public">{t.enums.visibility.public}</option>
              <option value="private">{t.enums.visibility.private}</option>
            </select>
          </label>
        </div>
      ) : null}

      {screenError ? <p className="error">{screenError}</p> : null}
      {loadingSessions ? <p className="subtle">{t.sessions.loading}</p> : null}

      {!loadingSessions && filteredSessions.length === 0 ? <p className="subtle">{t.sessions.noResults}</p> : null}

      <ul className="session-list">
        {filteredSessions.map((session) => {
          const membership = memberships[session.id]
          const requestStatus = myJoinRequestStatus[session.id]
          const categories = sessionCategoryNames[session.id] ?? []
          const readByUsers = sessionReadChaptersByUsers[session.id] ?? 0

          return (
            <li
              key={session.id}
              className="session-item session-card session-card-clickable"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
                navigate(`/session/${session.id}`)
              }}
            >
              <div className="session-card-inner">
                <div className="session-heading">
                  <h3>{session.book_title}</h3>
                  <span className="pill">{t.enums.visibility[session.visibility]}</span>
                </div>

                <p className="subtle session-card-author">{t.sessions.byAuthor(session.book_author)}</p>

                <div className="session-readby-strip" aria-label={t.sessions.readChaptersByUsersMetric}>
                  <span className="session-readby-label">{t.sessions.readChaptersByUsersMetric}</span>
                  <span className="session-readby-value">{readByUsers}</span>
                </div>

                {categories.length > 0 ? (
                  <div className="session-categories">
                    {categories.map((cat) => (
                      <span key={cat} className="category-pill">{cat}</span>
                    ))}
                  </div>
                ) : null}

                {session.description ? <p className="muted session-card-desc">{session.description}</p> : null}

                {!membership ? (
                  <button
                    type="button"
                    className="secondary session-card-cta"
                    disabled={busySessionId === session.id || requestStatus === 'pending'}
                    onClick={() => {
                      void onJoinSession(session.id)
                    }}
                  >
                    {session.join_policy === 'request'
                      ? requestStatus === 'pending'
                        ? t.sessions.requestPending
                        : t.sessions.requestToJoin
                      : busySessionId === session.id
                        ? t.sessions.joining
                        : t.sessions.joinSession}
                  </button>
                ) : (
                  <p className="muted session-card-hint">{t.sessions.openDetails}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </RootTag>
  )
})
