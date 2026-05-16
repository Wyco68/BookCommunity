import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Category,
} from '../types'

interface UseCategoriesInput {
  userId: string | null
}

interface UseCategoriesReturn {
  categories: Category[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
  getCategoryById: (id: number) => Category | undefined
}

export function useCategories({ userId }: UseCategoriesInput): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    const catResult = await supabase
      .from('categories')
      .select('id,name')
      .order('name', { ascending: true })

    if (catResult.error) {
      setError(catResult.error.message)
      setLoading(false)
      return
    }

    setCategories((catResult.data ?? []) as Category[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) {
      void loadCategories()
    } else {
      setCategories([])
    }
  }, [userId, loadCategories])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('categories-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => { void loadCategories() },
      )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, loadCategories])

  const getCategoryById = useCallback((id: number) => categories.find((c) => c.id === id), [categories])

  return {
    categories,
    loading,
    error,
    refreshCategories: loadCategories,
    getCategoryById,
  }
}
