import type { FormEvent } from 'react'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { Comment, Profile } from '../../types'
import { CommentThread } from './CommentThread'

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
  onSubmitComment,
  onCommentDraftChange,
  onToggleLike,
}: DiscussionTabProps) {
  if (!isMember) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '1rem' }}>
        <p className="subtle">{t.sessions.joinToDiscuss}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: '1.06rem' }}>{t.sessions.discussion}</h3>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <CommentThread
          t={t}
          language="en"
          comments={sessionComments}
          profiles={sessionProfiles}
          commentMeta={Object.fromEntries(
            sessionComments.map(c => [
              c.id, 
              { 
                likeCount: commentMeta.likeCounts[c.id] || 0, 
                isLikedByMe: !!commentMeta.likedByMe[c.id] 
              }
            ])
          )}
          onToggleLike={onToggleLike}
          draft={commentDraft}
          onDraftChange={onCommentDraftChange}
          onSubmit={onSubmitComment}
          posting={postingComment}
        />
      </div>
    </div>
  )
}
