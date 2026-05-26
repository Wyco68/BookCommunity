import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { UserNotificationPreferences } from '../types'

export function useNotificationPreferences(userId: string | undefined) {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (alive) {
        if (data) {
          setPrefs(data as UserNotificationPreferences)
        } else if (!error) {
          // Default if row doesn't exist yet
          setPrefs({
            user_id: userId!,
            email_enabled: false,
            email_session_joined: true,
            email_chapter_updated: true,
            email_session_deleted: true,
            email_comment_created: true,
            email_comment_liked: true,
            email_join_requested: true,
            updated_at: new Date().toISOString(),
          })
        }
        setLoading(false)
      }
    }
    void load()

    return () => {
      alive = false
    }
  }, [userId])

  const savePrefs = useCallback(async (newPrefs: UserNotificationPreferences) => {
    if (!userId) return false
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert({ ...newPrefs, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    setSaving(false)
    if (error) {
      setError(error.message)
      return false
    }
    setPrefs(newPrefs)
    return true
  }, [userId])

  return { prefs, loading, saving, error, savePrefs, setPrefs }
}
