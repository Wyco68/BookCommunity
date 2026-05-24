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
  SessionMembership,
} from '../types'
import { Spinner } from './Spinner'
import { MediaTab } from './SessionDetail/MediaTab'
import { ManageTab } from './SessionDetail/ManageTab'
import { DiscussionTab } from './SessionDetail/DiscussionTab'

type Copy = (typeof translations)[Language]

export type SessionDetailPanelTranslations = Copy

export type SessionDetailTab = 'media' | 'manage' | 'discussion'

export interface SessionDetailPanelProps {
  t: Copy
  activeTab: SessionDetailTab
  selectedSession: ReadingSession | null
  selectedIsOwner: boolean
  selectedIsMember: boolean
  loadingSessionDetail: boolean

  sessionMembers: SessionMembership[]
  sessionProfiles: Record<string, Profile>
  memberLatestProgress: Record<string, number>

  pendingRequests: SessionJoinRequest[]
  requestBusyId: string | null
  onApproveJoinRequest: (request: SessionJoinRequest) => Promise<void>
  onRejectJoinRequest: (request: SessionJoinRequest) => Promise<void>

  // Media tab
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

  // Manage tab
  currentUserId: string
  savingSettings: boolean
  settingsNotice: string | null
  onSaveSettings?: (visibility: 'public' | 'private', joinPolicy: 'open' | 'request') => Promise<void> | void
  onRemoveMember?: (userId: string) => Promise<void>
  removingMemberId: string | null
  onDeleteSession?: () => void
  onLeaveSession?: () => Promise<void>
  leavingSession: boolean
  leaveSessionDisabled: boolean

  // Discussion tab
  commentDraft: string
  postingComment: boolean
  sessionComments: Comment[]
  commentMeta: {
    likeCounts: Record<string, number>
    likedByMe: Record<string, boolean>
  }
  likingCommentId: string | null
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCommentDraftChange: (value: string) => void
  onToggleLike: (commentId: string) => Promise<void>

  fullWidth?: boolean
}

export const SessionDetailPanel = memo(function SessionDetailPanel(props: SessionDetailPanelProps) {
  const { t, activeTab, selectedSession } = props

  if (!selectedSession) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="subtle">{t.sessions.selectSessionPrompt}</p>
      </div>
    )
  }

  return (
    <article className={props.fullWidth ? 'card stack span-full' : 'card stack'}>
      {/* Header */}
      <div className="detail-header" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2>{selectedSession.book_title}</h2>
          <p className="subtle">{selectedSession.book_author}</p>
        </div>
      </div>

      {props.loadingSessionDetail ? (
        <div style={{ minHeight: 48, display: 'flex', alignItems: 'center' }}>
          <Spinner size="xs" showLabel label={t.sessions.loadingDetail} />
        </div>
      ) : null}

      {/* Tab content (local state switch — no remount of page) */}
      {activeTab === 'media' ? (
        <MediaTab
          t={t}
          session={selectedSession}
          isOwner={props.selectedIsOwner}
          isMember={props.selectedIsMember}
          activeChapter={props.activeChapter}
          maxChapter={props.maxChapter}
          activeChapterMedia={props.activeChapterMedia}
          activeChapterUrl={props.activeChapterUrl}
          loadingChapter={props.loadingChapter}
          onPrevChapter={props.onPrevChapter}
          onNextChapter={props.onNextChapter}
          myLatestChapter={props.myLatestChapter}
          savingChapterProgress={props.savingChapterProgress}
          onSaveCurrentChapter={props.onSaveCurrentChapter}
          canUploadMedia={props.canUploadMedia}
          mediaUploading={props.mediaUploading}
          mediaError={props.mediaError}
          mediaLimit={props.mediaLimit}
          nextChapter={props.nextChapter}
          onUploadMedia={props.onUploadMedia}
        />
      ) : null}

      {activeTab === 'discussion' ? (
        <DiscussionTab
          t={t}
          isMember={props.selectedIsMember}
          commentDraft={props.commentDraft}
          postingComment={props.postingComment}
          sessionComments={props.sessionComments}
          sessionProfiles={props.sessionProfiles}
          commentMeta={props.commentMeta}
          likingCommentId={props.likingCommentId}
          onSubmitComment={props.onSubmitComment}
          onCommentDraftChange={props.onCommentDraftChange}
          onToggleLike={props.onToggleLike}
        />
      ) : null}

      {activeTab === 'manage' ? (
        <ManageTab
          t={t}
          session={selectedSession}
          currentUserId={props.currentUserId}
          isOwner={props.selectedIsOwner}
          isMember={props.selectedIsMember}
          myLatestChapter={props.myLatestChapter}
          sessionMembers={props.sessionMembers}
          sessionProfiles={props.sessionProfiles}
          memberLatestProgress={props.memberLatestProgress}
          pendingRequests={props.pendingRequests}
          requestBusyId={props.requestBusyId}
          savingSettings={props.savingSettings}
          settingsNotice={props.settingsNotice}
          onSaveSettings={props.onSaveSettings}
          onApproveJoinRequest={props.onApproveJoinRequest}
          onRejectJoinRequest={props.onRejectJoinRequest}
          onRemoveMember={props.onRemoveMember}
          removingMemberId={props.removingMemberId}
          onDeleteSession={props.onDeleteSession}
          onLeaveSession={props.onLeaveSession}
          leavingSession={props.leavingSession}
          leaveSessionDisabled={props.leaveSessionDisabled}
        />
      ) : null}
    </article>
  )
})
