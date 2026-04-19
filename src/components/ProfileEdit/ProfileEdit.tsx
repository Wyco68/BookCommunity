import type { ChangeEvent, FormEvent } from 'react'
import { Avatar } from '../Avatar'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import styles from './ProfileEdit.module.css'

type Copy = (typeof translations)[Language]

interface ProfileEditProps {
  t: Copy
  myAvatarImage: string | null
  myAvatarLabel: string
  avatarInputKey: number
  avatarFile: File | null
  avatarUploadBusy: boolean
  profileNameDraft: string
  profileSaving: boolean
  profileNotice: string | null
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadAvatar: () => Promise<void>
  onProfileNameDraftChange: (value: string) => void
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>
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
    <section className={styles.profileEditGrid}>
      <article className="card stack">
        <div>
          <h2>{t.profile.title}</h2>
          <p className="subtle">{t.profile.subtitle}</p>
        </div>

        <div className="profile-card stack">
          <div className="profile-row">
            <Avatar imageUrl={myAvatarImage} label={myAvatarLabel} size="lg" />
            <div className="stack gap-sm profile-upload-stack">
              <label className="field">
                <span>{t.profile.avatarImage}</span>
                <input
                  key={avatarInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onAvatarFileChange}
                />
              </label>
              <button
                type="button"
                className="secondary"
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
              void onSaveProfile(event)
            }}
          >
            <label className="field">
              <span>{t.profile.displayName}</span>
              <input
                type="text"
                value={profileNameDraft}
                onChange={(event) => onProfileNameDraftChange(event.target.value)}
                placeholder={t.profile.displayNamePlaceholder}
                maxLength={80}
              />
            </label>
            <button type="submit" className="primary" disabled={profileSaving}>
              {profileSaving ? t.common.saving : t.profile.saveProfile}
            </button>
          </form>

          {profileNotice ? <p className="subtle">{profileNotice}</p> : null}
        </div>
      </article>
    </section>
  )
}

export type { ProfileEditProps }
