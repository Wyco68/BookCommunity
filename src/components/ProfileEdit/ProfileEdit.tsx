import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Avatar } from '../Avatar'
import { deleteAccount } from '../../lib/account'
import { supabase } from '../../lib/supabase'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { validatePassword } from '../../lib/validation'
import { getUsernameChangeStatus } from '../../lib/usernameCooldown'
import { SessionListPanel } from '../SessionListPanel'
import './ProfileEdit.css'

type Copy = (typeof translations)[Language]

interface ProfileEditProps {
  t: Copy
  language: Language
  userEmail: string | null
  currentUsername: string
  usernameUpdatedAt: string | null
  myAvatarImage: string | null
  myAvatarLabel: string
  avatarInputKey: number
  avatarFile?: File | null
  avatarUploadBusy: boolean
  usernameDraft: string
  profileSaving: boolean
  profileNotice: string | null
  profileError: string | null
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadAvatar: () => Promise<void>
  onUsernameDraftChange: (value: string) => void
  onSaveProfile: () => Promise<void>
  onSignOut: () => void
  listProps: any
}

function formatProfileError(error: string | null, t: Copy): string | null {
  if (!error) return null
  const lower = error.toLowerCase()
  if (lower.includes('already taken') || lower.includes('unique')) {
    return t.profile.usernameTaken
  }
  if (lower.includes('30 days') || lower.includes('once every')) {
    return error
  }
  if (lower.includes('invalid avatar path')) {
    return t.profile.avatarPathInvalid
  }
  return error
}

export function ProfileEdit({
  t,
  language,
  userEmail,
  currentUsername,
  usernameUpdatedAt,
  myAvatarImage,
  myAvatarLabel,
  avatarInputKey,
  avatarFile,
  avatarUploadBusy,
  usernameDraft,
  profileSaving,
  profileNotice,
  profileError,
  onAvatarFileChange,
  onUploadAvatar,
  onUsernameDraftChange,
  onSaveProfile,
  onSignOut,
  listProps,
}: ProfileEditProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile')
  const [usernameFocused, setUsernameFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const usernameStatus = useMemo(
    () => getUsernameChangeStatus(usernameUpdatedAt),
    [usernameUpdatedAt],
  )

  const usernameChanged = usernameDraft.trim().toLowerCase() !== currentUsername
  const usernameLocked = usernameChanged && !usernameStatus.canChange

  const nextChangeLabel = usernameStatus.nextChangeAt
    ? usernameStatus.nextChangeAt.toLocaleDateString(language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordNotice(null)

    if (!oldPassword.trim()) {
      setPasswordError(t.profile.oldPasswordRequired)
      return
    }

    const passwordCheck = validatePassword(newPassword)
    if (!passwordCheck.valid) {
      setPasswordError(t.profile.passwordMinLength)
      return
    }

    if (oldPassword === newPassword) {
      setPasswordError(t.profile.passwordMustDiffer)
      return
    }

    setPasswordBusy(true)

    const { data: userResult, error: userError } = await supabase.auth.getUser()
    const email = userResult.user?.email
    if (userError || !email) {
      setPasswordError(userError?.message || t.profile.unableToVerifyUser)
      setPasswordBusy(false)
      return
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    })
    if (reauthError) {
      setPasswordError(t.profile.oldPasswordIncorrect)
      setPasswordBusy(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordNotice(t.profile.passwordUpdated)
      setOldPassword('')
      setNewPassword('')
    }
    setPasswordBusy(false)
  }

  async function handleDeleteAccount() {
    setDeleteBusy(true)
    setDeleteError(null)

    const { error } = await deleteAccount()
    if (error) {
      setDeleteError(
        error === 'Account deletion failed.' || error === 'Failed to delete account'
          ? t.profile.deleteFailed
          : error,
      )
      setDeleteBusy(false)
      return
    }

    await onSignOut()
    setDeleteBusy(false)
  }

  const displayProfileError = formatProfileError(profileError, t)

  return (
    <div className="profile-page-container">
      <div className="profile-tab-wrapper">
        <div className="profile-tab-switch" role="tablist">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            {t.nav.profile}
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            {t.profile.settings}
          </button>
        </div>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-content-area">
          <section className="profile-card">
            <div className="profile-card-top-accent"></div>
            
            <div className="profile-avatar-col">
              <div className="profile-avatar-wrap">
                <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="xl" />
                <div className="profile-avatar-ring"></div>
              </div>
              <label className="profile-upload-label">
                {t.profile.uploadAvatar}
                <input
                  key={avatarInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onAvatarFileChange}
                  className="hidden"
                />
              </label>
              {avatarFile && (
                <button
                  type="button"
                  className="primary w-full"
                  disabled={avatarUploadBusy}
                  onClick={() => { void onUploadAvatar() }}
                >
                  {avatarUploadBusy ? t.common.uploading : t.common.save}
                </button>
              )}
            </div>

            <div className="profile-form-col">
              <form
                className="profile-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (usernameLocked) return
                  void onSaveProfile()
                }}
              >
                <div className="profile-input-wrapper">
                  <div className="profile-input-prefix">@</div>
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(event) => onUsernameDraftChange(event.target.value)}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    placeholder={t.profile.usernamePlaceholder}
                    autoComplete="username"
                    spellCheck={false}
                    maxLength={32}
                    className="profile-input with-prefix"
                  />
                  <div className={`profile-hint-wrap ${usernameFocused ? 'visible' : ''}`}>
                    <p className="profile-hint-text">{t.profile.usernameHint}</p>
                  </div>
                  {usernameLocked && nextChangeLabel && !usernameFocused && (
                    <p className="profile-hint-text error" style={{ color: '#f87171', marginTop: 'var(--space-2)' }}>
                      {t.profile.usernameChangeLocked(nextChangeLabel)}
                    </p>
                  )}
                </div>
                
                <button type="submit" className="primary w-full" disabled={profileSaving || usernameLocked}>
                  {profileSaving ? t.common.saving : t.common.save}
                </button>
                
                {profileNotice && <p className="msg-success">{profileNotice}</p>}
                {displayProfileError && <p className="msg-error">{displayProfileError}</p>}
              </form>
              
              <div className="profile-signout-wrap">
                <button type="button" className="btn-secondary" onClick={onSignOut}>
                  {t.auth.signOut}
                </button>
              </div>
            </div>
          </section>

          <section className="profile-sessions-section">
            <div className="profile-sessions-header">
              <div className="profile-sessions-header-accent"></div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>{t.sessions.createdByYou}</h2>
            </div>
            <SessionListPanel {...listProps} />
          </section>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="profile-content-area">
          <section className="profile-settings-card">
            <div className="profile-settings-top-accent"></div>
            
            <div className="settings-group">
              <h3 className="settings-group-title">{t.profile.account}</h3>
              <input
                type="email"
                value={userEmail ?? ''}
                readOnly
                disabled
                autoComplete="email"
                placeholder={t.profile.emailLabel}
                className="profile-input"
              />
            </div>

            <div className="settings-section-divider">
              <h3 className="settings-group-title">{t.profile.changePassword}</h3>
              
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t.profile.oldPasswordPlaceholder}
                autoComplete="current-password"
                className="profile-input"
              />
              
              <div className="profile-input-wrapper">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder={t.profile.newPasswordPlaceholder}
                  minLength={8}
                  autoComplete="new-password"
                  className="profile-input"
                />
                <div className={`profile-hint-wrap ${passwordFocused ? 'visible' : ''}`}>
                  <p className="profile-hint-text">{t.profile.passwordHint}</p>
                </div>
              </div>
              
              <button
                type="button"
                className="primary w-full"
                disabled={passwordBusy || !oldPassword.trim() || !newPassword.trim()}
                onClick={() => { void handleChangePassword() }}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {passwordBusy ? t.common.saving : t.profile.updatePassword}
              </button>
              
              {passwordNotice && <p className="msg-success">{passwordNotice}</p>}
              {passwordError && <p className="msg-error">{passwordError}</p>}
            </div>

            <div className="danger-zone-divider">
              <h3 className="settings-group-title danger">Danger Zone</h3>
              
              {!deleteConfirm ? (
                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={() => {
                    setDeleteConfirm(true)
                    setDeleteError(null)
                  }}
                >
                  {t.profile.deleteAccount}
                </button>
              ) : (
                <div className="danger-confirm-box">
                  <p className="danger-confirm-text">
                    {t.profile.deleteConfirm}
                  </p>
                  {deleteError && <p className="error m-0 text-sm">{deleteError}</p>}
                  <div className="danger-actions-row">
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={deleteBusy}
                      onClick={() => { void handleDeleteAccount() }}
                    >
                      {deleteBusy ? t.profile.deleting : t.profile.yesDelete}
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export type { ProfileEditProps }
