import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Notification } from '../types'
import { soundManager } from '../lib/soundManager'

const PAGE_SIZE = 20

export interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  hasMore: boolean
  cursor: string | null
  hasFetchedForUser: string | null

  // Actions
  fetchInitial: (userId: string) => Promise<void>
  fetchMore: (userId: string) => Promise<void>
  markRead: (id: string, userId: string) => Promise<void>
  markAllRead: (userId: string) => Promise<void>
  
  // Realtime actions
  addRealtimeNotification: (notification: Notification) => void
  updateRealtimeNotification: (notification: Notification, wasRead: boolean) => void
  reset: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  hasMore: false,
  cursor: null,
  hasFetchedForUser: null,

  fetchInitial: async (userId: string) => {
    // Prevent duplicate fetching if already fetched for this user
    if (get().hasFetchedForUser === userId) return;
    
    set({ loading: true, hasFetchedForUser: userId });

    const [notifsResponse, countResponse] = await Promise.all([
      supabase
        .from('notifications')
        .select('id,user_id,type,session_id,actor_id,metadata,is_read,idempotency_key,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    ]);

    if (notifsResponse.error) {
      console.error('fetchInitial error:', notifsResponse.error);
      set({ loading: false });
      return;
    }

    const rows = (notifsResponse.data ?? []) as Notification[];
    const last = rows[rows.length - 1];

    set({
      notifications: rows,
      unreadCount: countResponse.count ?? 0,
      hasMore: rows.length === PAGE_SIZE,
      cursor: last ? last.created_at : null,
      loading: false,
    });
  },

  fetchMore: async (userId: string) => {
    const state = get();
    if (!state.hasMore || !state.cursor || state.loading) return;

    set({ loading: true });

    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,type,session_id,actor_id,metadata,is_read,idempotency_key,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .lt('created_at', state.cursor)
      .limit(PAGE_SIZE);

    if (error) {
      console.error('fetchMore error:', error);
      set({ loading: false });
      return;
    }

    const rows = (data ?? []) as Notification[];
    const last = rows[rows.length - 1];

    set((prev) => {
      const seen = new Set(prev.notifications.map((n) => n.id));
      const newNotifs = rows.filter((r) => !seen.has(r.id));
      return {
        notifications: [...prev.notifications, ...newNotifs],
        hasMore: rows.length === PAGE_SIZE,
        cursor: last ? last.created_at : null,
        loading: false,
      };
    });
  },

  markRead: async (id: string, userId: string) => {
    const { notifications } = get();
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('markRead error:', error);
      // Revert optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, is_read: false } : n)),
        unreadCount: state.unreadCount + 1,
      }));
    }
  },

  markAllRead: async (userId: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('markAllRead error:', error);
      set({ hasFetchedForUser: null }); // Force refetch next time if we care
    }
  },

  addRealtimeNotification: (notification: Notification) => {
    set((state) => {
      if (state.notifications.some((n) => n.id === notification.id)) return state;

      if (notification.type === 'SESSION_JOINED' || notification.type === 'JOIN_REQUESTED') {
        soundManager.play('success');
      } else if (notification.type === 'CHAPTER_UPDATED') {
        soundManager.play('notification');
      }

      return {
        notifications: [notification, ...state.notifications],
        unreadCount: notification.is_read ? state.unreadCount : state.unreadCount + 1,
      };
    });
  },

  updateRealtimeNotification: (notification: Notification, wasRead: boolean) => {
    set((state) => {
      const existing = state.notifications.find((n) => n.id === notification.id);
      const alreadyReadLocally = existing?.is_read ?? false;
      let newUnreadCount = state.unreadCount;
      if (!alreadyReadLocally && notification.is_read && !wasRead) {
        newUnreadCount = Math.max(0, newUnreadCount - 1);
      }
      return {
        notifications: state.notifications.map((n) => (n.id === notification.id ? { ...n, ...notification } : n)),
        unreadCount: newUnreadCount,
      };
    });
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      loading: false,
      hasMore: false,
      cursor: null,
      hasFetchedForUser: null,
    });
  },
}));
