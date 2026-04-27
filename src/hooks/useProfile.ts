import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { resolveAvatarUrl } from '../lib/avatar'
import {
  ALLOWED_AVATAR_TYPES,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  getAvatarExtension,
  isRemoteUrl,
} from '../lib/avatar'

export interface UseProfileReturn {
  profile: Profile | null
  loading: boolean
  error: string | null
  avatarPreviewUrl: string | null
  avatarInputKey: number
  nameDraft: string
  saving: boolean
  uploading: boolean
  notice: string | null
  loadProfile: (userId: string) => Promise<void>
  saveProfile: (userId: string) => Promise<void>
  setNameDraft: (name: string) => void
  handleAvatarFile: (file: File | null) => void
  uploadAvatar: (userId: string) => Promise<void>
  setNotice: (notice: string | null) => void
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
  setAvatarInputKey: React.Dispatch<React.SetStateAction<number>>
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarInputKey, setAvatarInputKey] = useState(0)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true)
    setError(null)

    const upsertResult = await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id' })
    if (upsertResult.error) {
      setError(upsertResult.error.message)
      setLoading(false)
      return
    }

    const profileResult = await supabase
      .from('profiles')
      .select('id,display_name,avatar_url')
      .eq('id', userId)
      .maybeSingle()

    if (profileResult.error) {
      setError(profileResult.error.message)
      setLoading(false)
      return
    }

    const loadedProfile = (profileResult.data ?? { id: userId, display_name: null, avatar_url: null }) as Profile
    const avatarUrl = await resolveAvatarUrl(loadedProfile.avatar_url)

    setProfile(loadedProfile)
    setNameDraft(loadedProfile.display_name ?? '')
    setAvatarPreviewUrl(avatarUrl)
    setLoading(false)
  }, [])

  const saveProfile = useCallback(async (userId: string) => {
    if (saving) return

    setSaving(true)
    setNotice(null)

    const trimmedName = nameDraft.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName.length > 0 ? trimmedName : null })
      .eq('id', userId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    const nextProfile: Profile = {
      id: userId,
      display_name: trimmedName.length > 0 ? trimmedName : null,
      avatar_url: profile?.avatar_url ?? null,
    }

    setProfile(nextProfile)
    setNotice('Profile saved')
    setSaving(false)
  }, [nameDraft, profile, saving])

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

    const extension = getAvatarExtension(avatarFile)
    const nextPath = `${userId}/${crypto.randomUUID()}.${extension}`
    const previousPath = profile?.avatar_url && !isRemoteUrl(profile.avatar_url) ? profile.avatar_url : null

    const uploadResult = await supabase.storage.from(AVATAR_BUCKET).upload(nextPath, avatarFile, {
      cacheControl: '3600',
      upsert: true,
      contentType: avatarFile.type,
    })

    if (uploadResult.error) {
      setError(uploadResult.error.message)
      setUploading(false)
      return
    }

    const updateResult = await supabase.from('profiles').update({ avatar_url: nextPath }).eq('id', userId)
    if (updateResult.error) {
      setError(updateResult.error.message)
      setUploading(false)
      return
    }

    if (previousPath && previousPath !== nextPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
    }

    const updatedProfile: Profile = {
      id: userId,
      display_name: profile?.display_name ?? null,
      avatar_url: nextPath,
    }

    setProfile(updatedProfile)
    setAvatarFile(null)
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(null)
    setAvatarInputKey((current) => current + 1)
    setNotice('Avatar updated')
    setUploading(false)
  }, [avatarFile, avatarPreviewUrl, profile, uploading])

  return {
    profile,
    loading,
    error,
    avatarPreviewUrl,
    avatarInputKey,
    nameDraft,
    saving,
    uploading,
    notice,
    loadProfile,
    saveProfile,
    setNameDraft,
    handleAvatarFile,
    uploadAvatar,
    setNotice,
    setProfile,
    setAvatarInputKey,
  }
}