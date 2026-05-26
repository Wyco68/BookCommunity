import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Avatar } from '../Avatar'
import { deleteAccount } from '../../lib/account'
import { supabase } from '../../lib/supabase'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import { validatePassword } from '../../lib/validation'
import { getUsernameChangeStatus } from '../../lib/usernameCooldown'

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
}: ProfileEditProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)

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
    if (!oldPassword.trim()) {
      setPasswordNotice(t.profile.oldPasswordRequired)
      return
    }

    const passwordCheck = validatePassword(newPassword)
    if (!passwordCheck.valid) {
      setPasswordNotice(t.profile.passwordRequirements)
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{t.profile.account}</h1>
        <p className="subtle" style={{ margin: '0.5rem 0 0' }}>{t.profile.subtitle}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
                  if (usernameLocked) return
                  void onSaveProfile()
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div>
                  <label className="field-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t.profile.emailLabel}</label>
                  <input
                    type="email"
                    value={userEmail ?? ''}
                    readOnly
                    disabled
                    autoComplete="email"
                  />
                  <p className="subtle" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>{t.profile.emailUniqueHelp}</p>
                </div>

                <div
                  role="note"
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'var(--surface-elevated, rgba(255, 193, 7, 0.08))',
                    border: '1px solid var(--border)',
                    fontSize: '0.875rem',
                  }}
                >
                  <p style={{ margin: 0 }}>{t.profile.usernameChangePolicy}</p>
                  {!usernameStatus.canChange && nextChangeLabel ? (
                    <p className="subtle" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem' }}>
                      {t.profile.usernameChangeLocked(nextChangeLabel)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="field-label" style={{ display: 'block', marginBottom: '0.5rem' }}>{t.profile.username}</label>
                  <input
                    type="text"
                    value={usernameDraft}
                    onChange={(event) => onUsernameDraftChange(event.target.value)}
                    placeholder={t.profile.usernamePlaceholder}
                    autoComplete="username"
                    spellCheck={false}
                    maxLength={32}
                    aria-describedby="username-help"
                  />
                  <p id="username-help" className="subtle" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                    {t.profile.usernameHelp}
                  </p>
                  {usernameLocked && nextChangeLabel ? (
                    <p className="error" style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                      {t.profile.usernameChangeLocked(nextChangeLabel)}
                    </p>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button type="submit" className="primary" disabled={profileSaving || usernameLocked}>
                    {profileSaving ? t.common.saving : t.profile.saveProfile}
                  </button>
                  {profileNotice ? <span className="subtle" style={{ fontSize: '0.875rem' }}>{profileNotice}</span> : null}
                </div>
                {displayProfileError ? <p className="error" style={{ margin: 0 }}>{displayProfileError}</p> : null}
              </form>
            </div>
          </div>
        </section>

        <section className="card" style={{ padding: '1.5rem', background: 'var(--surface)' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>{t.profile.changePassword}</h3>
          <p className="subtle" style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>{t.profile.passwordRequirements}</p>
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
                minLength={8}
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
                  onClick={() => {
                    setDeleteConfirm(true)
                    setDeleteError(null)
                  }}
                >
                  {t.profile.deleteAccount}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p className="subtle" style={{ margin: 0, color: '#ef4444' }}>
                    {t.profile.deleteConfirm}
                  </p>
                  {deleteError ? (
                    <p className="error" style={{ margin: 0 }}>{deleteError}</p>
                  ) : null}
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
