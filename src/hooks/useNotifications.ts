import { useEffect } from 'react'
import { useNotificationStore } from '../store/useNotificationStore'
import type { Notification } from '../types'

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useNotifications(userId: string | null): UseNotificationsReturn {
  const store = useNotificationStore()

  useEffect(() => {
    if (userId) {
      void store.fetchInitial(userId)
    } else {
      store.reset()
    }
  }, [userId, store])

  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    loading: store.loading,
    hasMore: store.hasMore,
    loadMore: async () => { if (userId) await store.fetchMore(userId) },
    markRead: async (id: string) => { if (userId) await store.markRead(id, userId) },
    markAllRead: async () => { if (userId) await store.markAllRead(userId) },
  }
}
