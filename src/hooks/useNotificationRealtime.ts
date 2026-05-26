import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNotificationStore } from '../store/useNotificationStore'
import type { Notification } from '../types'

export function useNotificationRealtime(userId: string | null) {
  const store = useNotificationStore()

  useEffect(() => {
    if (!userId) {
      store.reset()
      return
    }

    void store.fetchInitial(userId)

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          store.addRealtimeNotification(newNotif)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          const wasRead = (payload.old as Notification | undefined)?.is_read ?? false
          store.updateRealtimeNotification(updated, wasRead)
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [userId, store])
}
