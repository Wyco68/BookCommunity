import { useEffect, useState } from 'react'
import type { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { Profile, ReadingSession, SessionJoinRequest, SessionMembership } from '../../types'
import { Avatar } from '../Avatar'

type Copy = (typeof translations)[Language]

export interface ManageTabProps {
  t: Copy
  session: ReadingSession
  currentUserId: string
  isOwner: boolean
  isMember: boolean

  myLatestChapter: number

  sessionMembers: SessionMembership[]
  sessionProfiles: Record<string, Profile>
  memberLatestProgress: Record<string, number>
  pendingRequests: SessionJoinRequest[]
  requestBusyId: string | null

  savingSettings: boolean
  settingsNotice: string | null
  onSaveSettings?: (visibility: 'public' | 'private', joinPolicy: 'open' | 'request') => Promise<void> | void

  onApproveJoinRequest?: (request: SessionJoinRequest) => Promise<void>
  onRejectJoinRequest?: (request: SessionJoinRequest) => Promise<void>

  onRemoveMember?: (userId: string) => Promise<void>
  removingMemberId: string | null

  onDeleteSession?: () => void

  onLeaveSession?: () => Promise<void>
  leavingSession: boolean
  leaveSessionDisabled: boolean
}

export function ManageTab({
  t,
  session,
  currentUserId,
  isOwner,
  isMember,
  myLatestChapter,
  sessionMembers,
  sessionProfiles,
  memberLatestProgress,
  pendingRequests,
  requestBusyId,
  savingSettings,
  settingsNotice,
  onSaveSettings,
  onApproveJoinRequest,
  onRejectJoinRequest,
  onRemoveMember,
  removingMemberId,
  onDeleteSession,
  onLeaveSession,
  leavingSession,
  leaveSessionDisabled,
}: ManageTabProps) {
  const [visibilityDraft, setVisibilityDraft] = useState<'public' | 'private'>(session.visibility)
  const [joinPolicyDraft, setJoinPolicyDraft] = useState<'open' | 'request'>(session.join_policy)

  useEffect(() => { setVisibilityDraft(session.visibility) }, [session.id, session.visibility])
  useEffect(() => { setJoinPolicyDraft(session.join_policy) }, [session.id, session.join_policy])

  const settingsDirty =
    visibilityDraft !== session.visibility || joinPolicyDraft !== session.join_policy

  // Non-member view: limited UI (nothing to manage)
  if (!isMember) {
    return (
      <div className="detail-pane">
        <p className="subtle">{t.sessions.notMemberHint}</p>
      </div>
    )
  }

  // Owner is excluded from progress tracking (DB + UI): never list the creator in the
  // owner’s “Member Progress” table. Non-owners see everyone else in the session (including
  // the owner’s row with 0/… progress since owners do not record updates).
  const membersForOwnerProgress = sessionMembers.filter((m) => m.user_id !== session.creator_id)
  const membersForMemberProgress = sessionMembers.filter((m) => m.user_id !== currentUserId)

  // Member (non-owner) view: own progress, read-only member list, leave action
  if (!isOwner) {
    return (
      <div className="stack">
        <section className="detail-pane stack">
          <h3 style={{ margin: 0 }}>{t.sessions.yourReading}</h3>
          <p className="subtle">
            {myLatestChapter > 0
              ? t.sessions.progressSummary(myLatestChapter, session.total_chapters)
              : t.sessions.progressNone}
          </p>
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, (myLatestChapter / Math.max(1, session.total_chapters)) * 100)}%`,
              }}
            />
          </div>
        </section>

        {/* Members + their progress (read-only for non-owner members). */}
        <section className="detail-pane stack">
          <h3 style={{ margin: 0 }}>{t.sessions.memberProgress}</h3>
          {membersForMemberProgress.length === 0 ? (
            <p className="subtle">{t.manage.noOtherMembers}</p>
          ) : (
            <ul className="member-list">
              {membersForMemberProgress.map((member) => {
                const profile = sessionProfiles[member.user_id]
                const chapter = memberLatestProgress[member.user_id] ?? 0
                const displayName = profile?.display_name || member.user_id.slice(0, 8)
                return (
                  <li key={member.user_id} className="member-item member-progress-row">
                    <div className="session-user-cols member-progress-cols" aria-label={t.sessions.memberProgress}>
                      <div className="session-user-col">
                        <span className="session-col-label">{t.sessions.cardColUsername}</span>
                        <span className="session-col-value session-col-truncate">{displayName}</span>
                      </div>
                      <div className="session-user-col">
                        <span className="session-col-label">{t.sessions.cardColChapters}</span>
                        <span className="session-col-value">
                          {t.sessions.chapterProgress(chapter, session.total_chapters)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {onLeaveSession ? (
          <section className="detail-pane stack">
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
              {leaveSessionDisabled ? (
                <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
                  {t.sessions.cannotLeaveOwnerSole}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div className="stack">
      {/* Unified Settings (visibility + join_policy) with ONE Save button */}
      <section className="detail-pane stack owner-panel">
        <h3 className="owner-panel-title">{t.manage.title}</h3>

        <div>
          <p className="owner-panel-label">{t.manage.visibility}</p>
          <select
            value={visibilityDraft}
            onChange={(e) => setVisibilityDraft(e.target.value as 'public' | 'private')}
            aria-label={t.manage.visibility}
          >
            <option value="public">{t.enums.visibility.public}</option>
            <option value="private">{t.enums.visibility.private}</option>
          </select>
        </div>

        <div>
          <p className="owner-panel-label">{t.manage.joinPolicy}</p>
          <div className="join-policy-toggle">
            <button
              type="button"
              className={joinPolicyDraft === 'open' ? 'primary' : 'secondary'}
              disabled={savingSettings}
              onClick={() => setJoinPolicyDraft('open')}
            >
              {t.manage.joinPolicyOpen}
            </button>
            <button
              type="button"
              className={joinPolicyDraft === 'request' ? 'primary' : 'secondary'}
              disabled={savingSettings}
              onClick={() => setJoinPolicyDraft('request')}
            >
              {t.manage.joinPolicyRequest}
            </button>
          </div>
        </div>

        <div className="owner-panel-save-row">
          <button
            type="button"
            className="primary"
            disabled={savingSettings || !settingsDirty || !onSaveSettings}
            onClick={() => {
              if (onSaveSettings) {
                void onSaveSettings(visibilityDraft, joinPolicyDraft)
              }
            }}
          >
            {savingSettings ? t.common.saving : t.manage.saveSettings}
          </button>
          {settingsNotice ? (
            <span
              className={
                settingsNotice.startsWith('Failed:')
                  ? 'subtle manage-settings-notice--error'
                  : 'subtle manage-settings-notice--ok'
              }
            >
              {settingsNotice}
            </span>
          ) : null}
        </div>
      </section>

      {/* Join Requests */}
      <section className="detail-pane stack">
        <h3 style={{ margin: 0 }}>{t.sessions.joinRequests}</h3>
        {pendingRequests.length === 0 ? (
          <p className="subtle">{t.sessions.noPendingRequests}</p>
        ) : (
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
                      onClick={() => { void onApproveJoinRequest?.(request) }}
                    >
                      {requestBusyId === request.id ? t.common.processing : t.sessions.approve}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={requestBusyId === request.id}
                      onClick={() => { void onRejectJoinRequest?.(request) }}
                    >
                      {t.sessions.reject}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Members + progress: everyone except the session creator (owners do not track reading). */}
      <section className="detail-pane stack">
        <h3 style={{ margin: 0 }}>{t.sessions.memberProgress}</h3>
        {membersForOwnerProgress.length === 0 ? (
          <p className="subtle">{t.manage.noOtherMembers}</p>
        ) : (
          <ul className="member-list">
            {membersForOwnerProgress.map((member) => {
              const profile = sessionProfiles[member.user_id]
              const chapter = memberLatestProgress[member.user_id] ?? 0
              const displayName = profile?.display_name || member.user_id.slice(0, 8)
              return (
                <li key={member.user_id} className="member-item member-progress-row">
                  <div className="session-user-cols member-progress-cols" aria-label={t.sessions.memberProgress}>
                    <div className="session-user-col">
                      <span className="session-col-label">{t.sessions.cardColUsername}</span>
                      <span className="session-col-value session-col-truncate">{displayName}</span>
                    </div>
                    <div className="session-user-col">
                      <span className="session-col-label">{t.sessions.cardColChapters}</span>
                      <span className="session-col-value">
                        {t.sessions.chapterProgress(chapter, session.total_chapters)}
                      </span>
                    </div>
                    <div className="session-user-col" style={{ alignItems: 'flex-end' }}>
                      {member.user_id !== currentUserId && onRemoveMember ? (
                        <button
                          type="button"
                          className="ghost owner-remove-btn"
                          disabled={removingMemberId === member.user_id}
                          onClick={() => { void onRemoveMember(member.user_id) }}
                        >
                          {removingMemberId === member.user_id ? t.manage.removing : t.manage.remove}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {onDeleteSession ? (
        <section className="detail-pane">
          <div className="danger-zone">
            <button type="button" className="btn-danger" onClick={onDeleteSession}>
              {t.manage.deleteSession}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
