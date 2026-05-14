import type { FormEvent } from 'react'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { Comment, Profile } from '../../types'
import { Avatar } from '../Avatar'

type Copy = (typeof translations)[Language]

export interface DiscussionTabProps {
  t: Copy
  isMember: boolean

  commentDraft: string
  postingComment: boolean
  sessionComments: Comment[]
  sessionProfiles: Record<string, Profile>
  commentMeta: {
    likeCounts: Record<string, number>
    likedByMe: Record<string, boolean>
  }
  likingCommentId: string | null

  onSubmitComment: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCommentDraftChange: (value: string) => void
  onToggleLike: (commentId: string) => Promise<void>
}

export function DiscussionTab({
  t,
  isMember,
  commentDraft,
  postingComment,
  sessionComments,
  sessionProfiles,
  commentMeta,
  likingCommentId,
  onSubmitComment,
  onCommentDraftChange,
  onToggleLike,
}: DiscussionTabProps) {
  if (!isMember) {
    return (
      <div className="detail-pane">
        <p className="subtle">{t.sessions.joinToDiscuss}</p>
      </div>
    )
  }

  return (
    <section className="detail-pane stack">
      <h3 style={{ margin: 0 }}>{t.sessions.discussion}</h3>

      <form className="stack" onSubmit={onSubmitComment}>
        <textarea
          value={commentDraft}
          onChange={(event) => onCommentDraftChange(event.target.value)}
          placeholder={t.sessions.commentPlaceholder}
          aria-label={t.sessions.yourComment}
        />
        <button type="submit" className="primary" disabled={postingComment}>
          {postingComment ? t.common.posting : t.sessions.postComment}
        </button>
      </form>

      <ul className="comment-list comment-list-scroll">
        {sessionComments.map((comment) => {
          const profile = sessionProfiles[comment.user_id]
          const likes = commentMeta.likeCounts[comment.id] ?? 0
          const likedByMe = Boolean(commentMeta.likedByMe[comment.id])
          return (
            <li key={comment.id} className="comment-item">
              <div className="comment-head">
                <div className="identity-row">
                  <Avatar
                    imageUrl={profile?.avatar_url ?? null}
                    label={profile?.display_name || comment.user_id.slice(0, 8)}
                    size="sm"
                  />
                  <strong>{profile?.display_name || comment.user_id.slice(0, 8)}</strong>
                </div>
                <span className="subtle">{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="comment-body">{comment.is_deleted ? t.sessions.deleted : comment.body}</p>
              <button
                type="button"
                className={`like-button ${likedByMe ? 'like-button-active' : ''}`}
                disabled={likingCommentId === comment.id}
                onClick={() => { void onToggleLike(comment.id) }}
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
    </section>
  )
}
