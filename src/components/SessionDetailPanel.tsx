import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type {
  Comment,
  Profile,
  ReadingSession,
  SessionJoinRequest,
  SessionMembership,
} from '../types'
import { Avatar } from './Avatar'

type Copy = (typeof translations)[Language]

export interface SessionDetailPanelProps {
  t: Copy
  selectedSession: ReadingSession | null
  selectedIsOwner: boolean
  selectedIsMember: boolean
  loadingSessionDetail: boolean
  sessionMembers: SessionMembership[]
  sessionProfiles: Record<string, Profile>
  memberLatestProgress: Record<string, number>
  pendingRequests: SessionJoinRequest[]
  requestBusyId: string | null
  commentDraft: string
  postingComment: boolean
  sessionComments: Comment[]
  commentMeta: {
    likeCounts: Record<string, number>
    likedByMe: Record<string, boolean>
  }
  likingCommentId: string | null
  onApproveJoinRequest: (request: SessionJoinRequest) => Promise<void>
  onRejectJoinRequest: (request: SessionJoinRequest) => Promise<void>
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCommentDraftChange: (value: string) => void
  onToggleLike: (commentId: string) => Promise<void>
  fullWidth?: boolean
}

export function SessionDetailPanel({
  t,
  selectedSession,
  selectedIsOwner,
  selectedIsMember,
  loadingSessionDetail,
  sessionMembers,
  sessionProfiles,
  memberLatestProgress,
  pendingRequests,
  requestBusyId,
  commentDraft,
  postingComment,
  sessionComments,
  commentMeta,
  likingCommentId,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onSubmitComment,
  onCommentDraftChange,
  onToggleLike,
  fullWidth = true,
}: SessionDetailPanelProps) {
  return (
    <article className={fullWidth ? 'card stack span-full' : 'card stack'}>
      {!selectedSession ? (
        <p className="subtle">{t.sessions.selectSessionPrompt}</p>
      ) : (
        <>
          <div className="detail-header">
            <div>
              <h2>{selectedSession.book_title}</h2>
              <p className="subtle">{t.sessions.singleThread}</p>
            </div>
          </div>

          <div className="detail-grid">
            <section className="detail-pane stack">
              <h3>{t.sessions.memberProgress}</h3>
              {loadingSessionDetail ? <p className="subtle">{t.sessions.loadingDetail}</p> : null}
              <ul className="member-list">
                {sessionMembers.map((member) => {
                  const profile = sessionProfiles[member.user_id]
                  const chapter = memberLatestProgress[member.user_id] ?? 0
                  const ratio = Math.min(100, Math.round((chapter / Math.max(1, selectedSession.total_chapters)) * 100))

                  return (
                    <li key={member.user_id} className="member-item">
                      <div className="member-head">
                        <div className="identity-row">
                          <Avatar imageUrl={profile?.avatar_url ?? null} label={profile?.display_name || member.user_id.slice(0, 8)} size="sm" />
                          <strong>{profile?.display_name || member.user_id.slice(0, 8)}</strong>
                        </div>
                        <span className="pill">{t.enums.role[member.role]}</span>
                      </div>
                      <div className="progress-track">
                        <span className="progress-fill" style={{ width: `${ratio}%` }} />
                      </div>
                      <span className="progress-label">{t.sessions.chapterProgress(chapter, selectedSession.total_chapters)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="detail-pane stack">
              {selectedIsOwner ? (
                <>
                  <h3>{t.sessions.joinRequests}</h3>
                  {pendingRequests.length === 0 ? <p className="subtle">{t.sessions.noPendingRequests}</p> : null}
                  <ul className="member-list">
                    {pendingRequests.map((request) => {
                      const profile = sessionProfiles[request.user_id]
                      return (
                        <li key={request.id} className="member-item stack gap-sm">
                          <div className="member-head">
                            <div className="identity-row">
                              <Avatar imageUrl={profile?.avatar_url ?? null} label={profile?.display_name || request.user_id.slice(0, 8)} size="sm" />
                              <strong>{profile?.display_name || request.user_id.slice(0, 8)}</strong>
                            </div>
                            <span className="subtle">{new Date(request.created_at).toLocaleString()}</span>
                          </div>
                          <div className="split compact">
                            <button
                              type="button"
                              className="secondary"
                              disabled={requestBusyId === request.id}
                              onClick={() => {
                                void onApproveJoinRequest(request)
                              }}
                            >
                              {requestBusyId === request.id ? t.common.processing : t.sessions.approve}
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={requestBusyId === request.id}
                              onClick={() => {
                                void onRejectJoinRequest(request)
                              }}
                            >
                              {t.sessions.reject}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}

              <h3>{t.sessions.discussion}</h3>
              {!selectedIsMember ? (
                <p className="subtle">{t.sessions.joinToDiscuss}</p>
              ) : (
                <>
                  <form className="stack" onSubmit={onSubmitComment}>
                    <label className="field">
                      <span>{t.sessions.yourComment}</span>
                      <textarea
                        value={commentDraft}
                        onChange={(event) => onCommentDraftChange(event.target.value)}
                        placeholder={t.sessions.commentPlaceholder}
                      />
                    </label>
                    <button type="submit" className="primary" disabled={postingComment}>
                      {postingComment ? t.common.posting : t.sessions.postComment}
                    </button>
                  </form>

                  <ul className="comment-list">
                    {sessionComments.map((comment) => {
                      const profile = sessionProfiles[comment.user_id]
                      const likes = commentMeta.likeCounts[comment.id] ?? 0
                      const likedByMe = Boolean(commentMeta.likedByMe[comment.id])

                      return (
                        <li key={comment.id} className="comment-item">
                          <div className="comment-head">
                            <div className="identity-row">
                              <Avatar imageUrl={profile?.avatar_url ?? null} label={profile?.display_name || comment.user_id.slice(0, 8)} size="sm" />
                              <strong>{profile?.display_name || comment.user_id.slice(0, 8)}</strong>
                            </div>
                            <span className="subtle">{new Date(comment.created_at).toLocaleString()}</span>
                          </div>
                          <p className="comment-body">{comment.is_deleted ? t.sessions.deleted : comment.body}</p>
                          <button
                            type="button"
                            className={`like-button ${likedByMe ? 'like-button-active' : ''}`}
                            disabled={likingCommentId === comment.id}
                            onClick={() => {
                              void onToggleLike(comment.id)
                            }}
                          >
                            {likingCommentId === comment.id
                              ? t.common.updating
                              : likedByMe
                                ? t.sessions.liked(likes)
                                : t.sessions.like(likes)}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </article>
  )
}
