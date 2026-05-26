import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../types'
import type { translations } from '../i18n'
import type { Language } from '../i18n'

type Copy = (typeof translations)[Language]

export interface SessionCardProps {
  t: Copy
  session: ReadingSession
  membership?: SessionMembership | null
  requestStatus?: SessionJoinRequest['status']
  categories?: string[]
  coverUrl?: string | null
  myProgress?: number
  uploadedCount?: number
  busy?: boolean
  onClick: () => void
  onJoinClick?: () => void
}

export function SessionCard({
  t,
  session,
  membership = null,
  requestStatus,
  categories = [],
  coverUrl = null,
  myProgress = 0,
  uploadedCount = 0,
  busy = false,
  onClick,
  onJoinClick,
}: SessionCardProps) {
  const isOwner = membership?.role === 'owner'
  const isMember = Boolean(membership)
  const isPending = requestStatus === 'pending'

  return (
    <li
      className="session-item session-card session-card-fixed session-card-clickable"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
        onClick()
      }}
    >
      <div className="session-card-cols" style={{ gridTemplateColumns: '60% 40%' }}>
        <div className="session-card-col-cover" aria-hidden="true">
          {coverUrl ? (
            <img
              className="session-card-cover-image w-full h-full object-cover aspect-[4/3]"
              src={coverUrl}
              alt={`${session.book_title} cover`}
              loading="lazy"
            />
          ) : (
            <img
              className="session-card-cover-image w-full h-full object-cover aspect-[4/3]"
              src="/default-cover.png"
              alt="Default cover"
              loading="lazy"
              style={{ background: '#222' }}
            />
          )}
        </div>

        <div className="session-card-col-info">
          <div className="session-heading">
            <h3 className="session-card-title">{session.book_title}</h3>
            <span className="pill">{t.enums.visibility[session.visibility]}</span>
          </div>

          <div className="session-card-badges">
            {categories.length > 0
              ? categories.map((cat) => (
                  <span key={cat} className="category-badge">{cat}</span>
                ))
              : null}
            {isOwner ? (
              <span className="join-policy-badge join-policy-badge-owner">
                {t.sessions.createdByYou}
              </span>
            ) : isMember ? (
              <span className="join-policy-badge join-policy-badge-joined">{t.sessions.joined}</span>
            ) : (
              <span className={`join-policy-badge join-policy-badge-${session.join_policy}`}>
                {session.join_policy === 'open' ? t.manage.joinPolicyOpen : t.manage.joinPolicyRequest}
              </span>
            )}
          </div>

          <p className="subtle session-card-author">{t.sessions.byAuthor(session.book_author)}</p>

          <div className="session-meta-grid">
            <div className="session-meta-item">
              <span className="session-meta-label">{t.sessions.chapters}</span>
              <span className="session-meta-value">
                {session.status_type === 'completed' ? t.sessions.completed : session.total_chapters}
              </span>
            </div>
            <div className="session-meta-item">
              <span className="session-meta-label">
                {isOwner ? t.sessions.uploaded : t.sessions.myProgress}
              </span>
              <span className="session-meta-value">
                {isOwner ? uploadedCount : myProgress}
              </span>
            </div>
          </div>

          {session.description ? (
            <p className="muted session-card-desc">{session.description}</p>
          ) : (
            <p className="muted session-card-desc">&nbsp;</p>
          )}

          <div className="session-card-footer">
            {!isMember && onJoinClick ? (
              isPending ? (
                <span className="pill session-card-cta">{t.sessions.requestPending}</span>
              ) : (
                <button
                  type="button"
                  className="secondary session-card-cta"
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); onJoinClick() }}
                >
                  {session.join_policy === 'request' ? t.sessions.requestToJoin : t.sessions.joinSession}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}
