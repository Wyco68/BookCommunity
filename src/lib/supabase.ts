import { createClient } from '@supabase/supabase-js'
import { getSupabasePublishableKey, getSupabaseUrl } from './supabaseEnv'

const supabaseUrl = getSupabaseUrl()
const supabasePublishableKey = getSupabasePublishableKey()

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).',
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
})
