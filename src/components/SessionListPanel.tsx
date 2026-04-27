import { memo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { translations } from '../i18n'
import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../types'

type Copy = typeof translations.en

export interface SessionListPanelProps {
  t: Copy
  sessionSearch: string
  visibilityFilter: 'all' | 'public' | 'private'
  screenError: string | null
  loadingSessions: boolean
  filteredSessions: ReadingSession[]
  memberships: Record<string, SessionMembership>
  latestProgress: Record<string, number>
  selectedSessionId: string | null
  myJoinRequestStatus: Record<string, SessionJoinRequest['status']>
  progressDrafts: Record<string, number>
  busySessionId: string | null
  totalSessionCount: number
  onSessionSearchChange: (value: string) => void
  onVisibilityFilterChange: (value: 'all' | 'public' | 'private') => void
  onSelectSession: (sessionId: string) => void
  onProgressDraftsChange: Dispatch<SetStateAction<Record<string, number>>>
  onUpdateProgress: (session: ReadingSession) => Promise<void>
  onLeaveSession: (sessionId: string) => Promise<void>
  onJoinSession: (sessionId: string) => Promise<void>
  showControls?: boolean
}

export const SessionListPanel = memo(function SessionListPanel({
  t,
  sessionSearch,
  visibilityFilter,
  screenError,
  loadingSessions,
  filteredSessions,
  memberships,
  latestProgress,
  selectedSessionId,
  myJoinRequestStatus,
  progressDrafts,
  busySessionId,
  totalSessionCount,
  onSessionSearchChange,
  onVisibilityFilterChange,
  onSelectSession,
  onProgressDraftsChange,
  onUpdateProgress,
  onLeaveSession,
  onJoinSession,
  showControls = true,
}: SessionListPanelProps) {
  return (
    <article className="card stack">
      <div>
        <h2>{t.sessions.findSessions}</h2>
        <p className="subtle">{t.sessions.activeSummary}</p>
      </div>

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
          const chapter = latestProgress[session.id] ?? 0
          const ratio = Math.min(100, Math.round((chapter / session.total_chapters) * 100))
          const isSelected = selectedSessionId === session.id
          const requestStatus = myJoinRequestStatus[session.id]

          return (
            <li key={session.id} className={`session-item ${isSelected ? 'session-item-selected' : ''}`}>
              <div className="stack gap-sm">
                <div className="session-heading">
                  <h3>{session.book_title}</h3>
                  <span className="pill">{t.enums.visibility[session.visibility]}</span>
                </div>

                <p className="subtle">{t.sessions.byAuthor(session.book_author)}</p>
                <p className="muted">{session.description || t.sessions.noDescription}</p>

                <div className="progress-row" aria-label={t.sessions.progressAria(session.book_title)}>
                  <div className="progress-track">
                    <span className="progress-fill" style={{ width: `${ratio}%` }} />
                  </div>
                  <span className="progress-label">{t.sessions.chapterProgress(chapter || '-', session.total_chapters)}</span>
                </div>

                <button type="button" className="tertiary" onClick={() => onSelectSession(session.id)}>
                  {isSelected ? t.sessions.viewingDetails : t.sessions.openDetails}
                </button>

                {membership ? (
                  <div className="split compact">
                    <label className="field">
                      <span>{t.sessions.updateChapter}</span>
                      <input
                        type="number"
                        min={1}
                        max={session.total_chapters}
                        value={progressDrafts[session.id] ?? 1}
                        onChange={(event) =>
                          onProgressDraftsChange((current) => ({
                            ...current,
                            [session.id]: Number.isNaN(Number(event.target.value)) ? 1 : Number(event.target.value),
                          }))
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="secondary"
                      disabled={busySessionId === session.id}
                      onClick={() => {
                        void onUpdateProgress(session)
                      }}
                    >
                      {busySessionId === session.id ? t.common.saving : t.sessions.saveProgress}
                    </button>

                    <button
                      type="button"
                      className="ghost"
                      disabled={busySessionId === session.id || (membership.role === 'owner' && totalSessionCount === 1)}
                      onClick={() => {
                        void onLeaveSession(session.id)
                      }}
                    >
                      {busySessionId === session.id ? t.common.working : t.sessions.leave}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="secondary"
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
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
})
