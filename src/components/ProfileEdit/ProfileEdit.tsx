import type { ChangeEvent } from 'react'
import { Avatar } from '../Avatar'

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

interface ProfileEditProps {
  t: { profile: ProfileField; common: CommonField }
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
}: ProfileEditProps) {
  return (
    <section className="feed">
      <div className="feed-header">
        <h1 className="feed-title">{t.profile.title}</h1>
      </div>
      <div className="feed-content">
        <article className="card" style={{ maxWidth: '100%', width: '100%' }}>
          <p className="subtle" style={{ marginBottom: '1.5rem' }}>{t.profile.subtitle}</p>

          <div className="profile-card stack" style={{ border: 'none', padding: 0, background: 'transparent' }}>
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
      </div>
    </section>
  )
}

export type { ProfileEditProps }