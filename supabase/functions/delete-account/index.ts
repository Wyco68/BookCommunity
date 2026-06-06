import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const PROFILE_AVATARS_BUCKET = 'profile-avatars'
const SESSION_MEDIA_BUCKET = 'session-media'
const SESSION_COVERS_BUCKET = 'session-covers'
const REMOVE_CHUNK_SIZE = 100

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function removePaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
): Promise<string | null> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return null

  for (let i = 0; i < unique.length; i += REMOVE_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + REMOVE_CHUNK_SIZE)
    const { error } = await admin.storage.from(bucket).remove(chunk)
    if (error) return error.message
  }

  return null
}

async function listAllUnderPrefix(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })

  if (error) {
    throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`)
  }

  for (const item of data ?? []) {
    if (!item?.name) continue
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      const nested = await listAllUnderPrefix(admin, bucket, fullPath)
      paths.push(...nested)
    } else {
      paths.push(fullPath)
    }
  }

  return paths
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization' }, 401)
  }

  const accessToken = authHeader.slice('Bearer '.length).trim()
  if (!accessToken) {
    return jsonResponse({ error: 'Missing authorization' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401)
  }

  const userId = userData.user.id
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const pathsToRemove: { bucket: string; paths: string[] }[] = []

    const avatarPrefix = userId
    const avatarObjects = await listAllUnderPrefix(admin, PROFILE_AVATARS_BUCKET, avatarPrefix)
    pathsToRemove.push({ bucket: PROFILE_AVATARS_BUCKET, paths: avatarObjects })

    const { data: createdSessions, error: sessionsError } = await admin
      .from('reading_sessions')
      .select('id, cover_image_path')
      .eq('creator_id', userId)

    if (sessionsError) {
      return jsonResponse({ error: 'Failed to load user sessions' }, 500)
    }

    const createdSessionIds = (createdSessions ?? []).map((s) => s.id as string)

    const mediaPathSet = new Set<string>()

    const { data: uploadedMedia, error: mediaError } = await admin
      .from('session_media')
      .select('file_path')
      .eq('uploader_id', userId)

    if (mediaError) {
      return jsonResponse({ error: 'Failed to load user media' }, 500)
    }

    for (const row of uploadedMedia ?? []) {
      if (row.file_path) mediaPathSet.add(row.file_path as string)
    }

    if (createdSessionIds.length > 0) {
      const { data: sessionMedia, error: sessionMediaError } = await admin
        .from('session_media')
        .select('file_path')
        .in('session_id', createdSessionIds)

      if (sessionMediaError) {
        return jsonResponse({ error: 'Failed to load session media' }, 500)
      }

      for (const row of sessionMedia ?? []) {
        if (row.file_path) mediaPathSet.add(row.file_path as string)
      }
    }

    pathsToRemove.push({ bucket: SESSION_MEDIA_BUCKET, paths: Array.from(mediaPathSet) })

    const coverPaths: string[] = []
    for (const session of createdSessions ?? []) {
      const cover = session.cover_image_path as string | null
      if (cover?.trim()) coverPaths.push(cover.trim())
      const sessionFolder = `${userId}/${session.id}`
      const folderObjects = await listAllUnderPrefix(admin, SESSION_COVERS_BUCKET, sessionFolder)
      coverPaths.push(...folderObjects)
    }

    const userCoversFolder = await listAllUnderPrefix(admin, SESSION_COVERS_BUCKET, userId)
    coverPaths.push(...userCoversFolder)
    pathsToRemove.push({ bucket: SESSION_COVERS_BUCKET, paths: coverPaths })

    for (const { bucket, paths } of pathsToRemove) {
      const removeError = await removePaths(admin, bucket, paths)
      if (removeError) {
        return jsonResponse({ error: 'Failed to remove storage objects' }, 500)
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return jsonResponse({ error: 'Failed to delete account' }, 500)
    }

    return jsonResponse({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('delete-account failed:', message)
    return jsonResponse({ error: 'Account deletion failed' }, 500)
  }
})
