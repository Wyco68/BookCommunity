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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{t.profile.title}</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Profile Card */}
        <section className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, textAlign: 'center', margin: '0 auto', maxWidth: '100%' }}>
              <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="xl" />
              <div style={{ marginTop: '1rem', width: '100%' }}>
                <label className="secondary" style={{ cursor: 'pointer', padding: '0.4rem 0.75rem', fontSize: '0.875rem', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                  {t.profile.avatarImage}
                  <input
                    key={avatarInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onAvatarFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {avatarFile && (
                <button
                  type="button"
                  className="primary"
                  style={{ marginTop: '0.5rem', width: '100%', maxWidth: '200px' }}
                  disabled={avatarUploadBusy}
                  onClick={() => { void onUploadAvatar() }}
                >
                  {avatarUploadBusy ? t.common.uploading : t.profile.uploadAvatar}
                </button>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '0', flexBasis: '250px' }}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void onSaveProfile()
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div>
                  <label className="field-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t.profile.displayName}</label>
                  <input
                    type="text"
                    value={profileNameDraft}
                    onChange={(event) => onProfileNameDraftChange(event.target.value)}
                    placeholder={t.profile.displayNamePlaceholder}
                    maxLength={80}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button type="submit" className="primary" disabled={profileSaving}>
                    {profileSaving ? t.common.saving : t.profile.saveProfile}
                  </button>
                  {profileNotice ? <span className="subtle" style={{ fontSize: '0.875rem' }}>{profileNotice}</span> : null}
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* Security Card */}
        <section className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>{t.profile.changePassword}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t.profile.oldPassword}</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t.profile.oldPasswordPlaceholder}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="field-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t.profile.newPassword}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.profile.newPasswordPlaceholder}
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="primary"
              disabled={passwordBusy || !oldPassword.trim() || !newPassword.trim()}
              onClick={() => { void handleChangePassword() }}
            >
              {passwordBusy ? t.common.saving : t.profile.updatePassword}
            </button>
            {passwordNotice ? <span className="subtle" style={{ fontSize: '0.875rem' }}>{passwordNotice}</span> : null}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="card" style={{ padding: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444' }}>Danger Zone</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <button type="button" className="secondary" onClick={onSignOut}>
                {t.auth.signOut}
              </button>
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {!deleteConfirm ? (
                <button
                  type="button"
                  className="secondary"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => setDeleteConfirm(true)}
                >
                  {t.profile.deleteAccount}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p className="subtle" style={{ margin: 0, color: '#ef4444' }}>
                    {t.profile.deleteConfirm}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="primary"
                      style={{ background: '#ef4444' }}
                      disabled={deleteBusy}
                      onClick={() => { void handleDeleteAccount() }}
                    >
                      {deleteBusy ? t.profile.deleting : t.profile.yesDelete}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export type { ProfileEditProps }