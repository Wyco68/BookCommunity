// supabase/functions/send-email/index.ts
// Internal-only: sends transactional emails via Resend.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INTERNAL_SECRET = Deno.env.get('NOTIFICATION_INTERNAL_SECRET') ?? 'bookcom-internal'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('EMAIL_FROM') ?? 'BookCom <notifications@bookcom.app>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://bookcom.app'

type NotificationEventType =
  | 'SESSION_JOINED'
  | 'SESSION_DELETED'
  | 'CHAPTER_UPDATED'
  | 'COMMENT_CREATED'
  | 'COMMENT_LIKED'
  | 'JOIN_REQUESTED'

interface EmailPayload {
  type: NotificationEventType
  sessionId: string
  sessionTitle: string
  actorUsername: string
  recipientEmails: Array<{ id: string; email: string }>
  profiles: Array<{ id: string; username: string }>
  metadata: Record<string, unknown>
}

function getEmailSubject(type: NotificationEventType, sessionTitle: string, actorUsername: string): string {
  switch (type) {
    case 'SESSION_JOINED':
      return `${actorUsername} joined your session "${sessionTitle}"`
    case 'JOIN_REQUESTED':
      return `${actorUsername} requested to join "${sessionTitle}"`
    case 'SESSION_DELETED':
      return `Session "${sessionTitle}" has been deleted`
    case 'CHAPTER_UPDATED':
      return `New chapter available in "${sessionTitle}"`
    case 'COMMENT_CREATED':
      return `${actorUsername} commented in "${sessionTitle}"`
    case 'COMMENT_LIKED':
      return `${actorUsername} liked your comment in "${sessionTitle}"`
    default:
      return 'New notification from BookCom'
  }
}

function getEmailBody(
  type: NotificationEventType,
  sessionTitle: string,
  actorUsername: string,
  recipientUsername: string,
  sessionUrl: string,
): string {
  const greeting = `Hi ${recipientUsername},`
  let body = ''

  switch (type) {
    case 'SESSION_JOINED':
      body = `<strong>${actorUsername}</strong> has joined your reading session <strong>"${sessionTitle}"</strong>.`
      break
    case 'JOIN_REQUESTED':
      body = `<strong>${actorUsername}</strong> requested to join your reading session <strong>"${sessionTitle}"</strong>. Review the request in BookCom.`
      break
    case 'SESSION_DELETED':
      body = `The reading session <strong>"${sessionTitle}"</strong> has been deleted by the owner.`
      break
    case 'CHAPTER_UPDATED':
      body = `A new chapter has been uploaded to <strong>"${sessionTitle}"</strong>. Log in to read it now.`
      break
    case 'COMMENT_CREATED':
      body = `<strong>${actorUsername}</strong> posted a new comment in <strong>"${sessionTitle}"</strong>.`
      break
    case 'COMMENT_LIKED':
      body = `<strong>${actorUsername}</strong> liked your comment in <strong>"${sessionTitle}"</strong>.`
      break
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #0e0e10; color: #f4f4f5; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 40px auto; background: #18181b; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 32px;">
    <tr><td>
      <p style="font-size: 1.1rem; font-weight: 600; color: #3E6AE1; margin: 0 0 8px;">BookCom</p>
      <p style="font-size: 1rem; color: #f4f4f5; margin: 0 0 16px;">${greeting}</p>
      <p style="font-size: 0.95rem; color: #a1a1aa; margin: 0 0 24px; line-height: 1.5;">${body}</p>
      <a href="${sessionUrl}" style="display: inline-block; background: #3E6AE1; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">Open session</a>
      <p style="font-size: 0.75rem; color: #52525b; margin: 24px 0 0;">
        You're receiving this because you have email notifications enabled.
        You can manage your preferences in your BookCom account settings.
      </p>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, x-internal-secret',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== INTERNAL_SECRET) {
    console.error('send-email: unauthorized call')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!RESEND_API_KEY) {
    console.error('send-email: RESEND_API_KEY is not set')
    return new Response(JSON.stringify({ ok: false, reason: 'No API key configured' }), { status: 200 })
  }

  let payload: EmailPayload
  try {
    payload = await req.json() as EmailPayload
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { type, sessionId, sessionTitle, actorUsername, recipientEmails, profiles } = payload

  if (!recipientEmails?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p.username]))
  const subject = getEmailSubject(type, sessionTitle, actorUsername)
  const sessionUrl = `${APP_URL.replace(/\/$/, '')}/session/${sessionId}`

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    : null

  let sent = 0

  for (const { id: uid, email: preResolvedEmail } of recipientEmails) {
    let toEmail = preResolvedEmail

    if (!toEmail && admin) {
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(uid)
      if (authError || !authUser?.user?.email) continue
      toEmail = authUser.user.email
    }

    if (!toEmail) continue

    const username = profileMap.get(uid) ?? 'Reader'
    const html = getEmailBody(type, sessionTitle, actorUsername, username, sessionUrl)

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [toEmail],
          subject,
          html,
        }),
      })
      if (res.ok) {
        sent += 1
      } else {
        const body = await res.text()
        console.error(`send-email: Resend error for uid ${uid}:`, body)
      }
    } catch (err) {
      console.error(`send-email: fetch error for uid ${uid}:`, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
