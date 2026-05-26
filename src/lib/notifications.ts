import { supabase } from './supabase'
import type { NotificationEventType } from '../types'

export interface CreateNotificationPayload {
  type: NotificationEventType
  sessionId: string
  actorId: string
  metadata?: Record<string, unknown>
}

/** Fire-and-forget notification via edge function. */
export function notifyCreate(payload: CreateNotificationPayload): void {
  void supabase.functions.invoke('create-notification', { body: payload })
}
