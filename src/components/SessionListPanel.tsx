import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { ReadingSession, SessionCardMediaPreview, SessionJoinRequest, SessionMembership } from '../types'

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
}: SessionListPanelProps) {
  const navigate = useNavigate()

  const rootClassName = embedded ? 'stack session-panel-embedded' : 'card stack'
  const RootTag = embedded ? 'div' : 'article'

  return (
    <RootTag className={rootClassName}>
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
          const firstMedia = sessionFirstMedia[session.id]
          const myProgress = latestProgress[session.id] ?? 0
          const uploadedCount = sessionUploadedChapterCount[session.id] ?? 0
          const isOwner = membership?.role === 'owner'

          return (
            <li
              key={session.id}
              className="session-item session-card session-card-clickable"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, input, select, textarea')) return
                navigate(`/session/${session.id}`)
              }}
            >
              <div className="session-card-cols">
                <div className="session-card-col-cover" aria-hidden="true">
                  {firstMedia?.is_image && firstMedia.signed_url ? (
                    <img
                      className="session-card-cover-image"
                      src={firstMedia.signed_url}
                      alt={`${session.book_title} cover`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="session-card-cover-empty">
                      <span className="session-card-no-cover-icon">📖</span>
                    </div>
                  )}
                </div>

                <div className="session-card-col-info">
                  <div className="session-heading">
                    <h3 className="session-card-title">{session.book_title}</h3>
                    <span className="pill">{t.enums.visibility[session.visibility]}</span>
                  </div>

                  <p className="subtle session-card-author">{t.sessions.byAuthor(session.book_author)}</p>

                  {categories.length > 0 ? (
                    <div className="session-categories">
                      {categories.map((cat) => (
                        <span key={cat} className="category-pill">{cat}</span>
                      ))}
                    </div>
                  ) : null}

                  <div className="session-meta-grid">
                    <div className="session-meta-item">
                      <span className="session-meta-label">Chapters</span>
                      <span className="session-meta-value">
                        {session.status_type === 'completed' ? 'Completed' : session.total_chapters}
                      </span>
                    </div>
                    <div className="session-meta-item">
                      <span className="session-meta-label">{isOwner ? 'Uploaded' : 'My Progress'}</span>
                      <span className="session-meta-value">
                        {isOwner ? uploadedCount : myProgress}
                      </span>
                    </div>
                  </div>

                  {session.description ? (
                    <p className="muted session-card-desc">{session.description}</p>
                  ) : null}

                  {!membership ? (
                    <button
                      type="button"
                      className="secondary session-card-cta"
                      disabled={busySessionId === session.id || requestStatus === 'pending'}
                      onClick={() => { void onJoinSession(session.id) }}
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
              </div>
            </li>
          )
        })}
      </ul>
    </RootTag>
  )
})
