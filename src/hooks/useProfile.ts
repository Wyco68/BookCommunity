import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { deleteUserAvatarFiles, uploadAvatarFile } from '../lib/storage'
import {
  ALLOWED_AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  resolveAvatarUrl,
} from '../lib/avatar'
import { mapAvatarUpdateError, mapProfileUpdateError } from '../lib/profileErrors'
import { getUsernameChangeStatus } from '../lib/usernameCooldown'

export interface UseProfileReturn {
  profile: Profile | null
  loading: boolean
  error: string | null
  avatarFile: File | null
  avatarPreviewUrl: string | null
  avatarInputKey: number
  usernameDraft: string
  saving: boolean
  uploading: boolean
  notice: string | null
  loadProfile: (userId: string) => Promise<void>
  saveProfile: (userId: string) => Promise<void>
  setUsernameDraft: (username: string) => void
  handleAvatarFile: (file: File | null) => void
  uploadAvatar: (userId: string) => Promise<void>
  setNotice: (notice: string | null) => void
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  setAvatarInputKey: React.Dispatch<React.SetStateAction<number>>
  setAvatarPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarInputKey, setAvatarInputKey] = useState(0)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)

    const profileResult = await supabase
      .from('profiles')
      .select('id,username,username_updated_at,avatar_url,created_at')
      .eq('id', userId)
      .maybeSingle()

    if (profileResult.error) {
      setError(profileResult.error.message)
      setLoading(false)
      return
    }

    if (!profileResult.data) {
      setError('Profile not found. Please sign out and sign in again.')
      setLoading(false)
      return
    }

    const loadedProfile = profileResult.data as Profile
    const avatarUrl = await resolveAvatarUrl(loadedProfile.avatar_url)

    setProfile(loadedProfile)
    setUsernameDraft(loadedProfile.username)
    setAvatarPreviewUrl(avatarUrl)
    setLoading(false)
  }, [])

  const saveProfile = useCallback(async (userId: string) => {
    if (saving) return

    setSaving(true)
    setNotice(null)
    setError(null)

    const nextUsername = usernameDraft.trim().toLowerCase()

    if (profile?.username === nextUsername) {
      setNotice('Profile saved')
      setSaving(false)
      return
    }

    const cooldown = getUsernameChangeStatus(profile?.username_updated_at)
    if (!cooldown.canChange) {
      setError(
        cooldown.nextChangeAt
          ? `You can change your username again on ${cooldown.nextChangeAt.toLocaleDateString()}.`
          : 'You can change your username once every 30 days.',
      )
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: nextUsername })
      .eq('id', userId)

    if (updateError) {
      setError(mapProfileUpdateError(updateError) ?? updateError.message)
      setSaving(false)
      return
    }

    const { data: refreshed } = await supabase
      .from('profiles')
      .select('username_updated_at')
      .eq('id', userId)
      .single()

    const nextProfile: Profile = {
      id: userId,
      username: nextUsername,
      username_updated_at: refreshed?.username_updated_at ?? new Date().toISOString(),
      avatar_url: profile?.avatar_url ?? null,
      created_at: profile?.created_at ?? '',
    }

    setProfile(nextProfile)
    setUsernameDraft(nextProfile.username)
    setNotice('Profile saved')
    setSaving(false)
  }, [usernameDraft, profile, saving])

  const handleAvatarFile = useCallback((file: File | null) => {
    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError('Invalid file type. Use PNG, JPEG, or WebP.')
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setError('File too large. Maximum 2MB.')
      return
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }

    setError(null)
    setAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }, [avatarPreviewUrl])

  const uploadAvatar = useCallback(async (userId: string) => {
    if (!avatarFile || uploading) return

    setUploading(true)
    setNotice(null)
    setError(null)

    if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
      setError('Invalid file type. Use PNG, JPEG, or WebP.')
      setUploading(false)
      return
    }

    if (avatarFile.size > MAX_AVATAR_BYTES) {
      setError('File too large. Maximum 2MB.')
      setUploading(false)
      return
    }

    const { path: nextPath, error: uploadError } = await uploadAvatarFile(userId, avatarFile)

    if (uploadError) {
      setError(`Storage upload failed: ${uploadError}`)
      setUploading(false)
      return
    }

    const updateResult = await supabase
      .from('profiles')
      .update({ avatar_url: nextPath })
      .eq('id', userId)

    if (updateResult.error) {
      await deleteUserAvatarFiles(userId, profile?.avatar_url ?? null)
      setError(mapAvatarUpdateError(updateResult.error.message) ?? `Profile update failed: ${updateResult.error.message}`)
      setUploading(false)
      return
    }

    const cleanupError = await deleteUserAvatarFiles(userId, nextPath)
    if (cleanupError) {
      setError(`Avatar updated but cleanup failed: ${cleanupError}`)
      setUploading(false)
      return
    }

    const updatedProfile: Profile = {
      id: userId,
      username: profile?.username ?? usernameDraft,
      username_updated_at: profile?.username_updated_at ?? null,
      avatar_url: nextPath,
      created_at: profile?.created_at ?? '',
    }

    setProfile(updatedProfile)
    setAvatarFile(null)

    const resolvedUrl = await resolveAvatarUrl(nextPath)
    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(resolvedUrl)
    setAvatarInputKey((current) => current + 1)
    setNotice('Avatar updated')
    setUploading(false)
  }, [avatarFile, avatarPreviewUrl, profile, usernameDraft, uploading])

  return {
    profile,
    loading,
    error,
    avatarFile,
    avatarPreviewUrl,
    avatarInputKey,
    usernameDraft,
    saving,
    uploading,
    notice,
    loadProfile,
    saveProfile,
    setUsernameDraft,
    handleAvatarFile,
    uploadAvatar,
    setNotice,
    setProfile,
    setAvatarInputKey,
    setAvatarPreviewUrl,
  }
}
