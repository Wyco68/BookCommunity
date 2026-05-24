
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
    <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
      <Avatar imageUrl={authorAvatarUrl} label={authorName} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontWeight: 540, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{authorName}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatTimeAgo(new Date(comment.created_at), language)}
          </span>
        </div>
        <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {comment.is_deleted ? t.sessions.deleted : comment.body}
        </p>
        {!comment.is_deleted && (
          <button
            className={`like-button ${isLikedByMe ? 'like-button-active' : ''}`}
            onClick={() => onToggleLike(comment.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>{isLikedByMe ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        )}
      </div>
    </div>
  )
}
