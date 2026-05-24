import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { MediaType, ReadingSession } from '../../types'
import { MediaUpload } from '../Media/MediaComponents'
import { ArrowLeft, ArrowRight } from 'lucide-react'

type Copy = (typeof translations)[Language]

export interface MediaTabProps {
  t: Copy
  session: ReadingSession
  isOwner: boolean
  isMember: boolean

  activeChapter: number
  maxChapter: number
  activeChapterMedia: { file_name: string; mime_type: string; media_type: 'image' | 'book_file' } | null
  activeChapterUrl: string | null
  loadingChapter: boolean
  onPrevChapter?: () => Promise<void> | void
  onNextChapter?: () => Promise<void> | void

  myLatestChapter: number
  savingChapterProgress: boolean
  onSaveCurrentChapter?: () => Promise<void> | void

  canUploadMedia: boolean
  mediaUploading: boolean
  mediaError: string | null
  mediaLimit: number
  nextChapter: number
  onUploadMedia?: (file: File, mediaType: MediaType, description?: string) => Promise<boolean>
}

export function MediaTab({
  t,
  session,
  isOwner,
  isMember,
  activeChapter,
  maxChapter,
  activeChapterMedia,
  activeChapterUrl,
  loadingChapter,
  onPrevChapter,
  onNextChapter,
  myLatestChapter,
  savingChapterProgress,
  onSaveCurrentChapter,
  canUploadMedia,
  mediaUploading,
  mediaError,
  mediaLimit,
  nextChapter,
  onUploadMedia,
}: MediaTabProps) {
  const noChapters = maxChapter < 1

  return (
    <div className="stack">
      {/* Owner upload */}
      {isOwner && onUploadMedia ? (
        <section className="detail-pane stack">
          {canUploadMedia ? (
            <MediaUpload
              t={t}
              onUpload={onUploadMedia}
              uploading={mediaUploading}
              error={mediaError}
              nextChapter={nextChapter}
              totalChapters={mediaLimit}
            />
          ) : (
            <p className="subtle">{t.sessions.allChaptersUploaded(mediaLimit)}</p>
          )}
        </section>
      ) : null}

      {/* Chapter viewer (members + owner can browse) */}
      {noChapters ? (
        <section className="detail-pane">
          <p className="subtle">{t.sessions.noChaptersYet}</p>
        </section>
      ) : (
        <section className="detail-pane chapter-viewer-fixed">
          <div className="chapter-viewer-nav">
            <button
              type="button"
              className="secondary"
              disabled={!onPrevChapter || activeChapter <= 1 || loadingChapter}
              onClick={() => { void onPrevChapter?.() }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={16} style={{ marginRight: '0.25rem' }} /> {t.media.prev}
            </button>
            <span className="chapter-viewer-label">
              {t.media.chapter(activeChapter)} <span className="subtle">/ {maxChapter}</span>
            </span>
            <button
              type="button"
              className="secondary"
              disabled={!onNextChapter || activeChapter >= maxChapter || loadingChapter}
              onClick={() => { void onNextChapter?.() }}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              {t.media.next} <ArrowRight size={16} style={{ marginLeft: '0.25rem' }} />
            </button>
          </div>

          <div className="chapter-viewer-body">
            {loadingChapter ? (
              <div className="chapter-viewer-loading">{t.media.loadingChapter}</div>
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
                      {t.media.openDownload}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="chapter-viewer-empty">
                <p className="subtle">{t.sessions.noContentForChapter}</p>
              </div>
            )}
          </div>

          {/* Per-chapter Save Progress — members only, not owner.
              STRICT SEQUENTIAL: button only enabled when activeChapter is exactly
              the next chapter after the user's current progress (current + 1).
              No skip-ahead, no backward overwrite. */}
          {isMember && !isOwner && onSaveCurrentChapter ? (
            <div className="chapter-save-row">
              <p className="muted chapter-save-status">
                {myLatestChapter > 0
                  ? t.sessions.progressSummary(myLatestChapter, session.total_chapters)
                  : t.sessions.progressNone}
              </p>
              <button
                type="button"
                className="primary chapter-save-btn"
                disabled={
                  savingChapterProgress ||
                  activeChapter < 1 ||
                  activeChapter > session.total_chapters ||
                  activeChapter > maxChapter ||
                  activeChapter !== myLatestChapter + 1
                }
                title={
                  activeChapter !== myLatestChapter + 1
                    ? (activeChapter <= myLatestChapter
                        ? t.sessions.progressSummary(myLatestChapter, session.total_chapters)
                        : undefined)
                    : undefined
                }
                onClick={() => { void onSaveCurrentChapter() }}
              >
                {savingChapterProgress ? t.common.saving : t.sessions.saveProgressChapter(activeChapter)}
              </button>
            </div>
          ) : null}
        </section>
      )}

      {!isMember ? (
        <section className="detail-pane">
          <p className="subtle">{t.sessions.notMemberHint}</p>
        </section>
      ) : null}
    </div>
  )
}
