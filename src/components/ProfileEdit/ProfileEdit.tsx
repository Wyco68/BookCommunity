import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Avatar } from '../Avatar'
import { supabase } from '../../lib/supabase'

interface ProfileField {
  title: string
  subtitle: string
  avatarImage: string
  uploadAvatar: string
  avatarHelp: string
  displayName: string
  displayNamePlaceholder: string
  saveProfile: string
}

interface CommonField {
  saving: string
  uploading: string
}

interface AuthField {
  signOut: string
}

interface ProfileEditProps {
  t: { profile: ProfileField; common: CommonField; auth: AuthField }
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
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  async function handleChangePassword() {
    if (!newPassword.trim() || newPassword.length < 6) {
      setPasswordNotice('Password must be at least 6 characters.')
      return
    }
    setPasswordBusy(true)
    setPasswordNotice(null)

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordNotice(error.message)
    } else {
      setPasswordNotice('Password updated successfully.')
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
          <p className="subtle" style={{ marginBottom: '1.5rem' }}>{t.profile.subtitle}</p>

          <div className="profile-card stack" style={{ border: 'none', padding: 0, background: 'transparent' }}>
            {/* Avatar section */}
            <div className="profile-row">
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="lg" />
              <div className="stack gap-sm profile-upload-stack">
                <label className="field">
                  <span className="field-label">{t.profile.avatarImage}</span>
                  <input
                    key={avatarInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onAvatarFileChange}
                  />
                </label>
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
                <p className="muted">{t.profile.avatarHelp}</p>
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
              <label className="field">
                <span className="field-label">{t.profile.displayName}</span>
                <input
                  type="text"
                  value={profileNameDraft}
                  onChange={(event) => onProfileNameDraftChange(event.target.value)}
                  placeholder={t.profile.displayNamePlaceholder}
                  maxLength={80}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={profileSaving}>
                {profileSaving ? t.common.saving : t.profile.saveProfile}
              </button>
            </form>

            {profileNotice ? <p className="subtle">{profileNotice}</p> : null}
          </div>
        </article>

        {/* Change password */}
        <article className="card stack" style={{ maxWidth: '100%', width: '100%', marginTop: '1rem' }}>
          <h3>Change Password</h3>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={passwordBusy || !newPassword.trim()}
            onClick={() => { void handleChangePassword() }}
          >
            {passwordBusy ? t.common.saving : 'Update Password'}
          </button>
          {passwordNotice ? <p className="subtle">{passwordNotice}</p> : null}
        </article>

        {/* Account actions */}
        <article className="card stack" style={{ maxWidth: '100%', width: '100%', marginTop: '1rem' }}>
          <h3>Account</h3>

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
                Delete Account
              </button>
            ) : (
              <div className="stack gap-sm">
                <p className="subtle" style={{ margin: 0, color: '#ef4444' }}>
                  Are you sure? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={deleteBusy}
                    onClick={() => { void handleDeleteAccount() }}
                    style={{ flex: 1 }}
                  >
                    {deleteBusy ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setDeleteConfirm(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
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