import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

const PAGE_SIZE = 20

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
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const loadedForUserRef = useRef<string | null>(null)

  const fetchPage = useCallback(async (afterCursor: string | null): Promise<void> => {
    if (!userId) return

    let query = supabase
      .from('notifications')
      .select('id,user_id,type,session_id,actor_id,metadata,is_read,idempotency_key,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (afterCursor) {
      query = query.lt('created_at', afterCursor)
    }

    const { data, error } = await query

    if (error) {
      console.error('useNotifications fetch error:', error)
      return
    }

    const rows = (data ?? []) as Notification[]
    const last = rows[rows.length - 1]
    cursorRef.current = last ? last.created_at : null
    setHasMore(rows.length === PAGE_SIZE)

    if (afterCursor) {
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id))
        return [...prev, ...rows.filter((r) => !seen.has(r.id))]
      })
    } else {
      setNotifications(rows)
    }
  }, [userId])

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadCount(count ?? 0)
  }, [userId])

  // Initial load (re-run when userId changes)
  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      setHasMore(false)
      cursorRef.current = null
      loadedForUserRef.current = null
      return
    }

    if (loadedForUserRef.current === userId) return
    loadedForUserRef.current = userId
    cursorRef.current = null

    setLoading(true)
    Promise.all([fetchPage(null), fetchUnreadCount()]).finally(() => setLoading(false))
  }, [userId, fetchPage, fetchUnreadCount])

  // Realtime: new notifications and read-state sync
  useEffect(() => {
    if (!userId) return

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
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev
            return [newNotif, ...prev]
          })
          if (!newNotif.is_read) {
            setUnreadCount((c) => c + 1)
          }
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
          setNotifications((prev) => {
            const existing = prev.find((n) => n.id === updated.id)
            const alreadyReadLocally = existing?.is_read ?? false
            if (!alreadyReadLocally && updated.is_read && !wasRead) {
              setUnreadCount((c) => Math.max(0, c - 1))
            }
            return prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          })
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursorRef.current) return
    setLoading(true)
    await fetchPage(cursorRef.current)
    setLoading(false)
  }, [hasMore, fetchPage])

  const markRead = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.is_read) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId ?? '')

    if (error) {
      console.error('markRead error:', error)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
      )
      setUnreadCount((c) => c + 1)
    }
  }, [userId, notifications])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId ?? '')
      .eq('is_read', false)

    if (error) {
      console.error('markAllRead error:', error)
      void fetchPage(null)
      void fetchUnreadCount()
    }
  }, [userId, fetchPage, fetchUnreadCount])

  return {
    notifications,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  }
}
