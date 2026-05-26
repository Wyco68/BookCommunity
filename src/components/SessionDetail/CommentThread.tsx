import React, { useEffect, useRef } from 'react'
import type { Comment, Profile } from '../../types'
import { CommentItem } from './CommentItem'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'

type Copy = (typeof translations)[Language]

interface CommentThreadProps {
  t: Copy
  language: Language
  comments: Comment[]
  profiles: Record<string, Profile>
  commentMeta: Record<string, { likeCount: number; isLikedByMe: boolean }>
  onToggleLike: (commentId: string) => void
  draft: string
  onDraftChange: (val: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  posting: boolean
}

export function CommentThread({
  t,
  language,
  comments,
  profiles,
  commentMeta,
  onToggleLike,
  draft,
  onDraftChange,
  onSubmit,
  posting,
}: CommentThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div 
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0' }}
      >
        {comments.length === 0 ? (
          <div className="empty">
            <p className="subtle">{t.sessions.noComments}</p>
          </div>
        ) : (
          comments.map(comment => {
            const author = profiles[comment.user_id]
            const meta = commentMeta[comment.id] || { likeCount: 0, isLikedByMe: false }
            return (
              <CommentItem
                key={comment.id}
                t={t}
                language={language}
                comment={comment}
                authorName={author?.username || 'User'}
                authorAvatarUrl={author?.avatar_url || null}
                isLikedByMe={meta.isLikedByMe}
                likeCount={meta.likeCount}
                onToggleLike={onToggleLike}
              />
            )
          })
        )}
      </div>
      
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={t.sessions.commentPlaceholder}
            disabled={posting}
            style={{ 
              flex: 1, 
              minHeight: '44px', 
              maxHeight: '120px', 
              resize: 'none', 
              padding: '0.5rem 0.75rem', 
              borderRadius: 'var(--radius-md)'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const formEvent = e as unknown as React.FormEvent<HTMLFormElement>
                onSubmit(formEvent)
              }
            }}
          />
          <button 
            type="submit" 
            className="primary" 
            disabled={posting || !draft.trim()}
            style={{ minHeight: '44px', borderRadius: 'var(--radius-md)' }}
          >
            {posting ? t.common.working : t.sessions.commentSubmit}
          </button>
        </form>
      </div>
    </div>
  )
}
