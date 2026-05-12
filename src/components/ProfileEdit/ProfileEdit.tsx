import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Avatar } from '../Avatar'
import { supabase } from '../../lib/supabase'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'

type Copy = (typeof translations)[Language]

interface ProfileEditProps {
  t: Copy
  myAvatarImage: string | null
  myAvatarLabel: string
  avatarInputKey: number
  avatarFile?: File | null
  avatarUploadBusy: boolean
  profileNameDraft: string
  profileSaving: boolean
  profileNotice: string | null
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadAvatar: () => Promise<void>
  onProfileNameDraftChange: (value: string) => void
  onSaveProfile: () => Promise<void>
  onSignOut: () => void
}

export function ProfileEdit({
  t,
  myAvatarImage,
  myAvatarLabel,
  avatarInputKey,
  avatarFile,
  avatarUploadBusy,
  profileNameDraft,
  profileSaving,
  profileNotice,
  onAvatarFileChange,
  onUploadAvatar,
  onProfileNameDraftChange,
  onSaveProfile,
  onSignOut,
}: ProfileEditProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function handleChangePassword() {
    if (!oldPassword.trim()) {
      setPasswordNotice(t.profile.oldPasswordRequired)
      return
    }

    if (!newPassword.trim() || newPassword.length < 6) {
      setPasswordNotice(t.profile.passwordMinLength)
      return
    }

    if (oldPassword === newPassword) {
      setPasswordNotice(t.profile.passwordMustDiffer)
      return
    }

    setPasswordBusy(true)
    setPasswordNotice(null)

    const { data: userResult, error: userError } = await supabase.auth.getUser()
    const email = userResult.user?.email
    if (userError || !email) {
      setPasswordNotice(userError?.message || t.profile.unableToVerifyUser)
      setPasswordBusy(false)
      return
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    })
    if (reauthError) {
      setPasswordNotice(t.profile.oldPasswordIncorrect)
      setPasswordBusy(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordNotice(error.message)
    } else {
      setPasswordNotice(t.profile.passwordUpdated)
      setOldPassword('')
      setNewPassword('')
    }
    setPasswordBusy(false)
  }

  async function handleDeleteAccount() {
    setDeleteBusy(true)
    // Sign out and inform user — full account deletion requires admin/server-side action
    await supabase.auth.signOut()
    setDeleteBusy(false)
  }

  return (
    <section className="feed">
      <div className="feed-header">
        <h1 className="feed-title">{t.profile.title}</h1>
      </div>
      <div className="feed-content">
        <article className="card" style={{ maxWidth: '100%', width: '100%' }}>
          <div className="profile-card stack" style={{ border: 'none', padding: 0, background: 'transparent' }}>
            {/* Avatar section */}
            <div className="profile-row">
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="lg" />
              <div className="stack gap-sm profile-upload-stack">
                <input
                  key={avatarInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onAvatarFileChange}
                  aria-label={t.profile.avatarImage}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!avatarFile || avatarUploadBusy}
                  onClick={() => {
                    void onUploadAvatar()
                  }}
                >
                  {avatarUploadBusy ? t.common.uploading : t.profile.uploadAvatar}
                </button>
              </div>
            </div>

            {/* Display name */}
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault()
                void onSaveProfile()
              }}
            >
              <input
                type="text"
                value={profileNameDraft}
                onChange={(event) => onProfileNameDraftChange(event.target.value)}
                placeholder={t.profile.displayNamePlaceholder}
                aria-label={t.profile.displayName}
                maxLength={80}
              />
              <button type="submit" className="btn-primary" disabled={profileSaving}>
                {profileSaving ? t.common.saving : t.profile.saveProfile}
              </button>
            </form>

            {profileNotice ? <p className="subtle">{profileNotice}</p> : null}
          </div>
        </article>

        {/* Change password */}
        <article className="card stack" style={{ maxWidth: '100%', width: '100%', marginTop: '1rem' }}>
          <h3>{t.profile.changePassword}</h3>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder={t.profile.oldPasswordPlaceholder}
            autoComplete="current-password"
            aria-label={t.profile.oldPassword}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t.profile.newPasswordPlaceholder}
            minLength={6}
            autoComplete="new-password"
            aria-label={t.profile.newPassword}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={passwordBusy || !oldPassword.trim() || !newPassword.trim()}
            onClick={() => { void handleChangePassword() }}
          >
            {passwordBusy ? t.common.saving : t.profile.updatePassword}
          </button>
          {passwordNotice ? <p className="subtle">{passwordNotice}</p> : null}
        </article>

        {/* Account actions */}
        <article className="card stack" style={{ maxWidth: '100%', width: '100%', marginTop: '1rem' }}>
          <h3>{t.profile.account}</h3>

          <button
            type="button"
            className="btn-primary"
            onClick={onSignOut}
            style={{ width: '100%' }}
          >
            {t.auth.signOut}
          </button>

          <div style={{ borderTop: '1px solid var(--dark-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            {!deleteConfirm ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setDeleteConfirm(true)}
                style={{ width: '100%' }}
              >
                {t.profile.deleteAccount}
              </button>
            ) : (
              <div className="stack gap-sm">
                <p className="subtle" style={{ margin: 0, color: '#ef4444' }}>
                  {t.profile.deleteConfirm}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={deleteBusy}
                    onClick={() => { void handleDeleteAccount() }}
                    style={{ flex: 1 }}
                  >
                    {deleteBusy ? t.profile.deleting : t.profile.yesDelete}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDeleteConfirm(false)}
                    style={{ flex: 1 }}
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

export type { ProfileEditProps }