// supabase/functions/create-notification/index.ts
// Creates in-app notifications and optionally triggers transactional email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const INTERNAL_SECRET = Deno.env.get('NOTIFICATION_INTERNAL_SECRET') ?? 'bookcom-internal'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept-profile, x-region',
}

function corsResponse(req: Request, body: BodyInit | null = null, status = 200): Response {
  const requested = req.headers.get('Access-Control-Request-Headers')
  const headers = {
    ...corsHeaders,
    ...(requested ? { 'Access-Control-Allow-Headers': requested } : {}),
  }
  return new Response(body, { status, headers })
}

type NotificationEventType =
  | 'SESSION_JOINED'
  | 'SESSION_DELETED'
  | 'CHAPTER_UPDATED'
  | 'COMMENT_CREATED'
  | 'COMMENT_LIKED'
  | 'JOIN_REQUESTED'

interface NotificationPayload {
  type: NotificationEventType
  sessionId: string
  actorId: string
  metadata?: Record<string, unknown>
}

interface RecipientRow {
  user_id: string
}

interface PrefRow {
  user_id: string
  email_enabled: boolean
  email_session_joined: boolean
  email_chapter_updated: boolean
  email_session_deleted: boolean
  email_comment_created: boolean
  email_comment_liked: boolean
  email_join_requested: boolean
}

const VALID_TYPES: NotificationEventType[] = [
  'SESSION_JOINED',
  'SESSION_DELETED',
  'CHAPTER_UPDATED',
  'COMMENT_CREATED',
  'COMMENT_LIKED',
  'JOIN_REQUESTED',
]

const eventEmailKey: Record<NotificationEventType, keyof PrefRow> = {
  SESSION_JOINED: 'email_session_joined',
  SESSION_DELETED: 'email_session_deleted',
  CHAPTER_UPDATED: 'email_chapter_updated',
  COMMENT_CREATED: 'email_comment_created',
  COMMENT_LIKED: 'email_comment_liked',
  JOIN_REQUESTED: 'email_join_requested',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildIdempotencyKey(
  type: NotificationEventType,
  sessionId: string,
  actorId: string,
  recipientUserId: string,
  metadata: Record<string, unknown>,
): string {
  if (type === 'COMMENT_LIKED') {
    const commentId = String(metadata.commentId ?? '')
    return `COMMENT_LIKED:${commentId}:${actorId}:${recipientUserId}`
  }

  if (type === 'CHAPTER_UPDATED') {
    const chapterKey = String(metadata.chapterId ?? metadata.chapterNumber ?? '')
    return `CHAPTER_UPDATED:${sessionId}:${actorId}:${recipientUserId}:${chapterKey}`
  }

  const timeBucket = Math.floor(Date.now() / (1000 * 60 * 5))
  return `${type}:${sessionId}:${actorId}:${recipientUserId}:${timeBucket}`
}

async function resolveRecipients(
  supabase: ReturnType<typeof createClient>,
  type: NotificationEventType,
  sessionId: string,
  sessionCreatorId: string,
  actorId: string,
  metadata: Record<string, unknown>,
): Promise<string[]> {
  if (type === 'SESSION_JOINED' || type === 'JOIN_REQUESTED') {
    return [sessionCreatorId]
  }

  if (type === 'COMMENT_LIKED') {
    const commentId = metadata.commentId
    if (typeof commentId !== 'string' || !commentId) {
      return []
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .select('id, user_id, session_id')
      .eq('id', commentId)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (error || !comment) return []

    const authorId = (comment as { user_id: string }).user_id
    if (authorId === actorId) return []

    return [authorId]
  }

  if (type === 'SESSION_DELETED' || type === 'CHAPTER_UPDATED' || type === 'COMMENT_CREATED') {
    const { data: members } = await supabase
      .from('session_members')
      .select('user_id')
      .eq('session_id', sessionId)

    return ((members ?? []) as RecipientRow[]).map((m) => m.user_id)
  }

  return []
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req, null, 204)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization' }, 401)
  }

  const accessToken = authHeader.slice('Bearer '.length).trim()
  if (!accessToken) {
    return jsonResponse({ error: 'Missing authorization' }, 401)
  }

  let payload: NotificationPayload
  try {
    payload = await req.json() as NotificationPayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { type, sessionId, actorId, metadata = {} } = payload

  if (!type || !sessionId || !actorId) {
    return jsonResponse({ error: 'Missing required fields: type, sessionId, actorId' }, 400)
  }

  if (!VALID_TYPES.includes(type)) {
    return jsonResponse({ error: `Invalid event type: ${type}` }, 400)
  }

  if (type === 'COMMENT_LIKED' && (typeof metadata.commentId !== 'string' || !metadata.commentId)) {
    return jsonResponse({ error: 'COMMENT_LIKED requires metadata.commentId' }, 400)
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401)
  }

  const callerId = userData.user.id

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const [sessionResult] = await Promise.all([
    supabase
      .from('reading_sessions')
      .select('id, creator_id, book_title')
      .eq('id', sessionId)
      .single(),
  ])

  if (sessionResult.error || !sessionResult.data) {
    return jsonResponse({ error: 'Session not found' }, 404)
  }

  const session = sessionResult.data as { id: string; creator_id: string; book_title: string }

  let effectiveActorId = callerId

  if (type === 'SESSION_JOINED' && callerId !== actorId) {
    if (session.creator_id !== callerId) {
      return jsonResponse({ error: 'Only the session owner may notify on behalf of a joiner' }, 403)
    }
    const { data: joinerMember, error: memberError } = await supabase
      .from('session_members')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', actorId)
      .maybeSingle()
    if (memberError || !joinerMember) {
      return jsonResponse({ error: 'Joining user is not a session member' }, 400)
    }
    effectiveActorId = actorId
  } else if (callerId !== actorId) {
    return jsonResponse({ error: 'actorId must match authenticated user' }, 403)
  }

  if (type === 'SESSION_DELETED') {
    if (session.creator_id !== effectiveActorId) {
      return jsonResponse({ error: 'Only the session creator may send deletion notifications' }, 403)
    }
  } else if (type === 'JOIN_REQUESTED') {
    if (effectiveActorId !== callerId) {
      return jsonResponse({ error: 'Join request notifications must come from the requesting user' }, 403)
    }
  } else if (
    type === 'CHAPTER_UPDATED'
    || type === 'COMMENT_CREATED'
    || type === 'COMMENT_LIKED'
    || type === 'SESSION_JOINED'
  ) {
    const { data: actorMember, error: actorMemberError } = await supabase
      .from('session_members')
      .select('user_id')
      .eq('session_id', sessionId)
      .eq('user_id', effectiveActorId)
      .maybeSingle()
    if (actorMemberError || !actorMember) {
      return jsonResponse({ error: 'Actor must be a session member' }, 403)
    }
  }

  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', effectiveActorId)
    .single()

  const actor = actorProfile as { id: string; username: string } | null

  let recipientUserIds = await resolveRecipients(
    supabase,
    type,
    sessionId,
    session.creator_id,
    effectiveActorId,
    metadata,
  )

  recipientUserIds = recipientUserIds.filter((uid) => uid !== effectiveActorId)

  if (recipientUserIds.length === 0) {
    return jsonResponse({ ok: true, created: 0 })
  }

  const enrichedMeta = {
    sessionTitle: session.book_title,
    actorUsername: actor?.username ?? 'Someone',
    ...metadata,
  }

  const notifications = recipientUserIds.map((uid) => ({
    user_id: uid,
    type,
    session_id: sessionId,
    actor_id: effectiveActorId,
    metadata: enrichedMeta,
    idempotency_key: buildIdempotencyKey(type, sessionId, effectiveActorId, uid, metadata),
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('notifications')
    .insert(notifications)
    .select('id, user_id')

  if (insertError) {
    if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
      console.error('Insert error:', insertError)
      return jsonResponse({ error: insertError.message }, 500)
    }
  }

  const createdCount = (inserted ?? []).length

  if (createdCount > 0) {
    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`
    const recipientIds = (inserted ?? []).map((r: { user_id: string }) => r.user_id)

    const { data: prefs } = await supabase
      .from('user_notification_preferences')
      .select(
        'user_id, email_enabled, email_session_joined, email_chapter_updated, email_session_deleted, email_comment_created, email_comment_liked, email_join_requested',
      )
      .in('user_id', recipientIds)

    const prefsMap = new Map(((prefs ?? []) as PrefRow[]).map((p) => [p.user_id, p]))

    const emailEligibleIds = recipientIds.filter((uid) => {
      const pref = prefsMap.get(uid)
      if (!pref) return false
      if (!pref.email_enabled) return false
      const key = eventEmailKey[type]
      return pref[key] !== false
    })

    if (emailEligibleIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', emailEligibleIds)

      const recipientEmails: Array<{ id: string; email: string }> = []
      for (const uid of emailEligibleIds) {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(uid)
        if (authError || !authUser?.user?.email) continue
        recipientEmails.push({ id: uid, email: authUser.user.email })
      }

      if (recipientEmails.length > 0) {
        const emailPayload = {
          type,
          sessionId,
          sessionTitle: session.book_title,
          actorUsername: actor?.username ?? 'Someone',
          recipientEmails,
          profiles: profiles ?? [],
          metadata: enrichedMeta,
        }

        fetch(sendEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': INTERNAL_SECRET,
          },
          body: JSON.stringify(emailPayload),
        }).catch((err: unknown) => {
          console.error('send-email fire-and-forget error:', err)
        })
      }
    }
  }

  return jsonResponse({ ok: true, created: createdCount })
})
