/**
 * Vite inlines env at build time. Support both publishable and legacy anon key names
 * so Vercel/production configs match local `.env.local` naming.
 */
export function getSupabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? import.meta.env.VITE_SUPABASE_ANON_KEY
  )
}
