
import type { Comment } from '../../types'
import { Avatar } from '../Avatar'
import { formatTimeAgo } from '../../lib/formatTimeAgo'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'

type Copy = (typeof translations)[Language]

interface CommentItemProps {
  t: Copy
  language: Language
  comment: Comment
  authorName: string
  authorAvatarUrl: string | null
  isLikedByMe: boolean
  likeCount: number
  onToggleLike: (commentId: string) => void
}

export function CommentItem({
  t,
  language,
  comment,
  authorName,
  authorAvatarUrl,
  isLikedByMe,
  likeCount,
  onToggleLike,
}: CommentItemProps) {
  return (
    <div className="comment-row">
      <Avatar imageUrl={authorAvatarUrl} label={authorName} size="md" />
      <div className="comment-row-body">
        <div className="comment-row-head">
          <span className="comment-row-author">{authorName}</span>
          <span className="comment-row-time">
            {formatTimeAgo(new Date(comment.created_at), language)}
          </span>
        </div>
        <p className="comment-row-text">
          {comment.is_deleted ? t.sessions.deleted : comment.body}
        </p>
        {!comment.is_deleted && (
          <button
            className={`like-button comment-row-like-btn ${isLikedByMe ? 'like-button-active' : ''}`}
            onClick={() => onToggleLike(comment.id)}
          >
            <span>{isLikedByMe ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        )}
      </div>
    </div>
  )
}
