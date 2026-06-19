import type { FormEvent } from 'react'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { Comment, Profile } from '../../types'
import { CommentThread } from './CommentThread'
import { soundManager } from '../../lib/soundManager'

type Copy = (typeof translations)[Language]

export interface DiscussionTabProps {
  t: Copy
  language: Language
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
  language,
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
      <div className="discussion-tab-empty">
        <p className="subtle">{t.sessions.joinToDiscuss}</p>
      </div>
    )
  }

  const handleToggleLike = async (commentId: string) => {
    const isLiked = !!commentMeta.likedByMe[commentId]
    if (!isLiked) {
      soundManager.play('pop')
    }
    await onToggleLike(commentId)
  }

  return (
    <div className="discussion-tab">
      <div className="discussion-tab-header">
        <h3>{t.sessions.discussion}</h3>
      </div>
      <div className="discussion-tab-thread">
        <CommentThread
          t={t}
          language={language}
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
          onToggleLike={handleToggleLike}
          draft={commentDraft}
          onDraftChange={onCommentDraftChange}
          onSubmit={onSubmitComment}
          posting={postingComment}
        />
      </div>
    </div>
  )
}
