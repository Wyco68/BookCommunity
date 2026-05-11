import { memo, useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type {
  Comment,
  MediaType,
  Profile,
  ReadingSession,
  SessionJoinRequest,
  SessionMembership,
} from '../types'
import { Avatar } from './Avatar'
import { MediaUpload } from './Media/MediaComponents'

type Copy = (typeof translations)[Language]

export type SessionDetailPanelTranslations = Copy

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
  mediaUploading?: boolean
  mediaError?: string | null
  onUploadMedia?: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  currentUserId?: string
  canUploadMedia?: boolean
  mediaCount?: number
  mediaLimit?: number
  nextChapter?: number
  readChaptersByUsers?: number
  onLeaveSession?: () => Promise<void>
  leavingSession?: boolean
  myProgressChapterDraft?: number
  onMyProgressChapterDraftChange?: (chapter: number) => void
  onSaveMyProgress?: () => Promise<void>
  savingMyProgress?: boolean
  leaveSessionDisabled?: boolean
  maxProgressChapter?: number
  activeChapter?: number
  maxChapter?: number
  activeChapterMedia?: { file_name: string; mime_type: string; media_type: 'image' | 'book_file' } | null
  activeChapterUrl?: string | null
  loadingChapter?: boolean
  onPrevChapter?: () => Promise<void>
  onNextChapter?: () => Promise<void>
  onUpdateVisibility?: (v: 'public' | 'private') => Promise<void>
  updatingVisibility?: boolean
  onRemoveMember?: (userId: string) => Promise<void>
  removingMemberId?: string | null
  onDeleteSession?: () => void
}

export const SessionDetailPanel = memo(function SessionDetailPanel({
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
  mediaUploading = false,
  mediaError = null,
  onUploadMedia,
  currentUserId,
  canUploadMedia = false,
  mediaLimit = 0,
  nextChapter = 1,
  readChaptersByUsers = 0,
  onLeaveSession,
  leavingSession = false,
  myProgressChapterDraft = 1,
  onMyProgressChapterDraftChange,
  onSaveMyProgress,
  savingMyProgress = false,
  leaveSessionDisabled = false,
  maxProgressChapter,
  activeChapter = 1,
  maxChapter = 0,
  activeChapterMedia = null,
  activeChapterUrl = null,
  loadingChapter = false,
  onPrevChapter,
  onNextChapter,
  onUpdateVisibility,
  updatingVisibility = false,
  onRemoveMember,
  removingMemberId = null,
  onDeleteSession,
}: SessionDetailPanelProps) {
  const [visibilityDraft, setVisibilityDraft] = useState<'public' | 'private'>(
    selectedSession?.visibility ?? 'public',
  )

  useEffect(() => {
    if (selectedSession?.visibility) setVisibilityDraft(selectedSession.visibility)
  }, [selectedSession?.id, selectedSession?.visibility])

  return (
    <article className={fullWidth ? 'card stack span-full' : 'card stack'}>
      {!selectedSession ? (
        <p className="subtle">{t.sessions.selectSessionPrompt}</p>
      ) : (
        <>
          {/* Header */}
          <div className="detail-header">
            <div>
              <h2>{selectedSession.book_title}</h2>
              <p className="subtle">{selectedSession.book_author}</p>
            </div>
            <span className="detail-stat-pill">
              {readChaptersByUsers > 0 ? `${readChaptersByUsers} chapters read by members` : null}
            </span>
          </div>

          {/* Owner upload */}
          {selectedIsOwner && onUploadMedia ? (
            <section className="detail-pane stack">
              {canUploadMedia ? (
                <MediaUpload
                  onUpload={onUploadMedia}
                  uploading={mediaUploading}
                  error={mediaError}
                  nextChapter={nextChapter}
                  totalChapters={mediaLimit}
                />
              ) : (
                <p className="subtle">
                  All {mediaLimit} chapter{mediaLimit !== 1 ? 's' : ''} uploaded.
                </p>
              )}
            </section>
          ) : null}

          {/* Owner management panel */}
          {selectedIsOwner && (onUpdateVisibility ?? onRemoveMember ?? onDeleteSession) ? (
            <section className="detail-pane stack owner-panel">
              <h3 className="owner-panel-title">Manage Session</h3>

              {onUpdateVisibility ? (
                <div className="owner-panel-row">
                  <label className="field" style={{ flex: 1, margin: 0 }}>
                    <span>Visibility</span>
                    <select
                      value={visibilityDraft}
                      onChange={(e) => setVisibilityDraft(e.target.value as 'public' | 'private')}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    disabled={updatingVisibility || visibilityDraft === selectedSession.visibility}
                    onClick={() => { void onUpdateVisibility(visibilityDraft) }}
                  >
                    {updatingVisibility ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : null}

              {onRemoveMember ? (
                <div>
                  <p className="owner-panel-label">Members</p>
                  {sessionMembers.filter((m) => m.user_id !== currentUserId).length === 0 ? (
                    <p className="subtle">No other members.</p>
                  ) : (
                    <ul className="member-list owner-member-list">
                      {sessionMembers
                        .filter((m) => m.user_id !== currentUserId)
                        .map((member) => {
                          const profile = sessionProfiles[member.user_id]
                          return (
                            <li key={member.user_id} className="member-item owner-member-item">
                              <div className="identity-row">
                                <Avatar
                                  imageUrl={profile?.avatar_url ?? null}
                                  label={profile?.display_name || member.user_id.slice(0, 8)}
                                  size="sm"
                                />
                                <span className="owner-member-name">
                                  {profile?.display_name || member.user_id.slice(0, 8)}
                                </span>
                                <span className="subtle">({t.enums.role[member.role]})</span>
                              </div>
                              <button
                                type="button"
                                className="ghost owner-remove-btn"
                                disabled={removingMemberId === member.user_id}
                                onClick={() => { void onRemoveMember(member.user_id) }}
                              >
                                {removingMemberId === member.user_id ? 'Removing…' : 'Remove'}
                              </button>
                            </li>
                          )
                        })}
                    </ul>
                  )}
                </div>
              ) : null}

              {onDeleteSession ? (
                <div className="danger-zone">
                  <button type="button" className="btn-danger" onClick={onDeleteSession}>
                    Delete Session
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Member reading progress */}
          {selectedIsMember && !selectedIsOwner && onSaveMyProgress && onMyProgressChapterDraftChange ? (
            <section className="detail-pane stack detail-my-reading">
              <h3>{t.sessions.yourReading}</h3>
              <div className="detail-my-reading-row">
                <label className="field">
                  <span>{t.sessions.updateChapter}</span>
                  <input
                    type="number"
                    min={1}
                    max={maxProgressChapter ?? selectedSession.total_chapters}
                    value={myProgressChapterDraft}
                    onChange={(event) => {
                      const n = Number(event.target.value)
                      onMyProgressChapterDraftChange(Number.isNaN(n) ? 1 : n)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary detail-save-progress-btn"
                  disabled={savingMyProgress || (maxProgressChapter ?? 0) < 1}
                  onClick={() => { void onSaveMyProgress() }}
                >
                  {savingMyProgress ? t.common.saving : t.sessions.saveProgress}
                </button>
              </div>
              {onLeaveSession ? (
                <div className="detail-leave-row">
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={leavingSession || leaveSessionDisabled}
                    title={leaveSessionDisabled ? t.sessions.cannotLeaveOwnerSole : undefined}
                    onClick={() => { void onLeaveSession() }}
                  >
                    {leavingSession ? t.common.working : t.sessions.leave}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Chapter viewer — fixed-height section above discussion to prevent layout shift */}
          {selectedIsMember && maxChapter > 0 ? (
            <section className="detail-pane chapter-viewer-fixed">
              <div className="chapter-viewer-nav">
                <button
                  type="button"
                  className="secondary"
                  disabled={!onPrevChapter || activeChapter <= 1 || loadingChapter}
                  onClick={() => { void onPrevChapter?.() }}
                >
                  ← Prev
                </button>
                <span className="chapter-viewer-label">
                  Chapter {activeChapter} <span className="subtle">/ {maxChapter}</span>
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={!onNextChapter || activeChapter >= maxChapter || loadingChapter}
                  onClick={() => { void onNextChapter?.() }}
                >
                  Next →
                </button>
              </div>

              <div className="chapter-viewer-body">
                {loadingChapter ? (
                  <div className="chapter-viewer-loading">Loading chapter…</div>
                ) : activeChapterMedia && activeChapterUrl ? (
                  <div className="chapter-viewer-content">
                    {activeChapterMedia.media_type === 'image' ? (
                      <img
                        className="chapter-viewer-image"
                        src={activeChapterUrl}
                        alt={activeChapterMedia.file_name}
                      />
                    ) : activeChapterMedia.mime_type === 'application/pdf' ? (
                      <iframe
                        className="chapter-viewer-pdf"
                        src={activeChapterUrl}
                        title={activeChapterMedia.file_name}
                      />
                    ) : (
                      <div className="chapter-viewer-file">
                        <p className="muted">{activeChapterMedia.file_name}</p>
                        <a
                          href={activeChapterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="secondary"
                        >
                          Open / Download
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="chapter-viewer-empty">
                    <p className="subtle">No content for this chapter yet.</p>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Member list + join requests */}
          <div className="detail-grid detail-two-col">
            <section className="detail-pane stack">
              <h3>{t.sessions.memberProgress}</h3>
              {loadingSessionDetail ? <p className="subtle">{t.sessions.loadingDetail}</p> : null}
              <ul className="member-list">
                {sessionMembers.map((member) => {
                  const profile = sessionProfiles[member.user_id]
                  const chapter = memberLatestProgress[member.user_id] ?? 0
                  return (
                    <li key={member.user_id} className="member-item member-progress-row">
                      <div className="session-user-cols member-progress-cols" aria-label={t.sessions.memberProgress}>
                        <div className="session-user-col">
                          <span className="session-col-label">{t.sessions.cardColUsername}</span>
                          <span className="session-col-value session-col-truncate">
                            {profile?.display_name || member.user_id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="session-user-col">
                          <span className="session-col-label">{t.sessions.cardColRole}</span>
                          <span className="session-col-value">{t.enums.role[member.role]}</span>
                        </div>
                        <div className="session-user-col">
                          <span className="session-col-label">{t.sessions.cardColChapters}</span>
                          <span className="session-col-value">
                            {t.sessions.chapterProgress(chapter, selectedSession.total_chapters)}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            {selectedIsOwner ? (
              <section className="detail-pane stack">
                <h3>{t.sessions.joinRequests}</h3>
                {pendingRequests.length === 0 ? (
                  <p className="subtle">{t.sessions.noPendingRequests}</p>
                ) : null}
                <ul className="member-list">
                  {pendingRequests.map((request) => {
                    const profile = sessionProfiles[request.user_id]
                    return (
                      <li key={request.id} className="member-item stack gap-sm">
                        <div className="member-head">
                          <div className="identity-row">
                            <Avatar
                              imageUrl={profile?.avatar_url ?? null}
                              label={profile?.display_name || request.user_id.slice(0, 8)}
                              size="sm"
                            />
                            <strong>{profile?.display_name || request.user_id.slice(0, 8)}</strong>
                          </div>
                          <span className="subtle">{new Date(request.created_at).toLocaleString()}</span>
                        </div>
                        <div className="split compact">
                          <button
                            type="button"
                            className="secondary"
                            disabled={requestBusyId === request.id}
                            onClick={() => { void onApproveJoinRequest(request) }}
                          >
                            {requestBusyId === request.id ? t.common.processing : t.sessions.approve}
                          </button>
                          <button
                            type="button"
                            className="ghost"
                            disabled={requestBusyId === request.id}
                            onClick={() => { void onRejectJoinRequest(request) }}
                          >
                            {t.sessions.reject}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            {/* Discussion */}
            <section className="detail-pane stack span-full">
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
                </>
              )}
            </section>
          </div>

        </>
      )}
    </article>
  )
})
