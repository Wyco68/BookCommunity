import { supabase } from './supabase'

export async function deleteAccount(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  })

  if (error) {
    return { error: error.message }
  }

  const body = data as { success?: boolean; error?: string } | null
  if (body?.error) {
    return { error: body.error }
  }

  if (!body?.success) {
    return { error: body?.error ?? 'Account deletion failed.' }
  }

  return { error: null }
}
