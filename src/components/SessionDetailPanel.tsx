import { memo } from 'react'
import type { FormEvent } from 'react'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type {
  Comment,
  MediaType,
  Profile,
  ReadingSession,
  SessionJoinRequest,
  SessionMedia,
  SessionMembership,
} from '../types'
import { Avatar } from './Avatar'
import { MediaUpload, MediaGallery } from './Media/MediaComponents'

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
  media?: SessionMedia[]
  mediaUrls?: Record<string, string>
  mediaLoading?: boolean
  mediaUploading?: boolean
  mediaError?: string | null
  mediaHasMore?: boolean
  onUploadMedia?: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
  onRemoveMedia?: (item: SessionMedia) => Promise<boolean>
  onLoadMoreMedia?: () => Promise<void>
  currentUserId?: string
  canUploadMedia?: boolean
  mediaCount?: number
  mediaLimit?: number
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
  media,
  mediaUrls,
  mediaLoading,
  mediaUploading,
  mediaError,
  mediaHasMore,
  onUploadMedia,
  onRemoveMedia,
  onLoadMoreMedia,
  currentUserId,
  canUploadMedia,
  mediaCount,
  mediaLimit,
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
            <span className="detail-stat-pill">Read chapters by users: {readChaptersByUsers}</span>
          </div>

          {selectedIsMember && !selectedIsOwner && selectedSession && onSaveMyProgress && onMyProgressChapterDraftChange ? (
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
                    disabled={selectedIsOwner}
                    onChange={(event) => {
                      const n = Number(event.target.value)
                      onMyProgressChapterDraftChange(Number.isNaN(n) ? 1 : n)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary detail-save-progress-btn"
                  disabled={selectedIsOwner || savingMyProgress || (maxProgressChapter ?? selectedSession.total_chapters) < 1}
                  onClick={() => {
                    void onSaveMyProgress()
                  }}
                >
                  {savingMyProgress ? t.common.saving : t.sessions.saveProgress}
                </button>
              </div>
              {selectedIsOwner ? (
                <p className="subtle">Session owners cannot submit progress; upload chapters via media library.</p>
              ) : null}
              {onLeaveSession ? (
                <div className="detail-leave-row">
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={leavingSession || leaveSessionDisabled}
                    title={leaveSessionDisabled ? t.sessions.cannotLeaveOwnerSole : undefined}
                    onClick={() => {
                      void onLeaveSession()
                    }}
                  >
                    {leavingSession ? t.common.working : t.sessions.leave}
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {selectedIsOwner ? (
            <section className="detail-pane stack detail-my-reading">
              <h3>{t.sessions.yourReading}</h3>
              <p className="subtle">Owners cannot submit progress. Upload chapters to manage session content.</p>
            </section>
          ) : null}

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
              </section>
            ) : null}

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

          {selectedIsMember && media && onRemoveMedia && onLoadMoreMedia && currentUserId ? (
            <section className="detail-pane stack">
              <div className="detail-header">
                <h3>Chapters / Media Library</h3>
                {mediaLimit != null && mediaCount != null ? (
                  <span className="pill">{mediaCount} / {mediaLimit}</span>
                ) : null}
              </div>

              <div className="detail-pane stack">
                <div className="split compact">
                  <button
                    type="button"
                    className="secondary"
                    disabled={!onPrevChapter || activeChapter <= 1 || loadingChapter}
                    onClick={() => { void onPrevChapter?.() }}
                  >
                    Prev
                  </button>
                  <span className="pill">Chapter {activeChapter} / {maxChapter}</span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!onNextChapter || activeChapter >= maxChapter || loadingChapter}
                    onClick={() => { void onNextChapter?.() }}
                  >
                    Next
                  </button>
                </div>

                {loadingChapter ? <p className="subtle">Loading chapter…</p> : null}
                {!loadingChapter && activeChapterMedia && activeChapterUrl ? (
                  activeChapterMedia.media_type === 'image' ? (
                    <img className="media-thumbnail" src={activeChapterUrl} alt={activeChapterMedia.file_name} loading="lazy" />
                  ) : activeChapterMedia.mime_type === 'application/pdf' ? (
                    <iframe className="media-pdf-frame" src={activeChapterUrl} title={activeChapterMedia.file_name} />
                  ) : (
                    <div className="media-file-icon">
                      <p className="muted media-filename">{activeChapterMedia.file_name}</p>
                      <a href={activeChapterUrl} target="_blank" rel="noopener noreferrer" className="secondary media-download-link">Open / Download</a>
                    </div>
                  )
                ) : null}
              </div>

              {canUploadMedia && onUploadMedia ? (
                <MediaUpload
                  onUpload={onUploadMedia}
                  uploading={mediaUploading ?? false}
                  error={mediaError ?? null}
                />
              ) : null}

              {!canUploadMedia && selectedIsOwner && mediaCount != null && mediaLimit != null && mediaCount >= mediaLimit ? (
                <p className="subtle">Media limit reached ({mediaLimit} files, one per chapter).</p>
              ) : null}

              <MediaGallery
                media={media}
                mediaUrls={mediaUrls ?? {}}
                loading={mediaLoading ?? false}
                hasMore={mediaHasMore ?? false}
                onLoadMore={onLoadMoreMedia}
                onRemove={onRemoveMedia}
                currentUserId={currentUserId}
                sessionOwnerId={selectedSession.creator_id}
              />
            </section>
          ) : null}
        </>
      )}
    </article>
  )
})
