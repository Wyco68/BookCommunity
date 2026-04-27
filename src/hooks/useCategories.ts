import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  checkRateLimit,
  recordAction,
  CATEGORY_CREATE_RATE_LIMIT,
} from '../lib/rateLimit'
import {
  validateCategoryName,
  validateDescription,
  validateVisibility,
} from '../lib/validation'
import type {
  Category,
  CategoryMember,
  CategoryVisibility,
} from '../types'

interface UseCategoriesInput {
  userId: string | null
}

interface UseCategoriesReturn {
  categories: Category[]
  categoryMembers: Record<string, CategoryMember>
  loading: boolean
  error: string | null
  createCategory: (name: string, description: string, visibility: CategoryVisibility) => Promise<Category | null>
  joinCategory: (categoryId: string) => Promise<boolean>
  leaveCategory: (categoryId: string) => Promise<boolean>
  refreshCategories: () => Promise<void>
  getCategoryById: (id: string) => Category | undefined
  myCategoryIds: string[]
}

export function useCategories({ userId }: UseCategoriesInput): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([])
  const [membershipList, setMembershipList] = useState<CategoryMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryMembers = useMemo(() => {
    const map: Record<string, CategoryMember> = {}
    for (const m of membershipList) {
      map[m.category_id] = m
    }
    return map
  }, [membershipList])

  const myCategoryIds = useMemo(
    () => membershipList.map((m) => m.category_id),
    [membershipList],
  )

  const loadCategories = useCallback(async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    const [catResult, memResult] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('category_members')
        .select('*')
        .eq('user_id', userId),
    ])

    if (catResult.error) {
      setError(catResult.error.message)
      setLoading(false)
      return
    }

    if (memResult.error) {
      setError(memResult.error.message)
      setLoading(false)
      return
    }

    setCategories((catResult.data ?? []) as Category[])
    setMembershipList((memResult.data ?? []) as CategoryMember[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) {
      void loadCategories()
    } else {
      setCategories([])
      setMembershipList([])
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'category_members', filter: `user_id=eq.${userId}` },
        () => { void loadCategories() },
      )

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, loadCategories])

  const createCategory = useCallback(async (
    name: string,
    description: string,
    visibility: CategoryVisibility,
  ): Promise<Category | null> => {
    if (!userId) return null

    const nameValidation = validateCategoryName(name)
    if (!nameValidation.valid) {
      setError(nameValidation.error)
      return null
    }

    const descValidation = validateDescription(description)
    if (!descValidation.valid) {
      setError(descValidation.error)
      return null
    }

    const visValidation = validateVisibility(visibility)
    if (!visValidation.valid) {
      setError(visValidation.error)
      return null
    }

    const rateCheck = checkRateLimit(`category-create:${userId}`, CATEGORY_CREATE_RATE_LIMIT)
    if (!rateCheck.allowed) {
      setError(`Please wait ${Math.ceil(rateCheck.retryAfterMs / 1000)}s before creating another category`)
      return null
    }

    setError(null)

    const { data, error: insertError } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        creator_id: userId,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      return null
    }

    const category = data as Category

    await supabase.from('category_members').insert({
      category_id: category.id,
      user_id: userId,
      role: 'owner',
    })

    recordAction(`category-create:${userId}`, CATEGORY_CREATE_RATE_LIMIT.windowMs)
    await loadCategories()
    return category
  }, [userId, loadCategories])

  const joinCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    if (!userId) return false
    setError(null)

    const { error: joinError } = await supabase
      .from('category_members')
      .insert({
        category_id: categoryId,
        user_id: userId,
        role: 'member',
      })

    if (joinError) {
      if (joinError.message.toLowerCase().includes('duplicate')) {
        return true
      }
      setError(joinError.message)
      return false
    }

    await loadCategories()
    return true
  }, [userId, loadCategories])

  const leaveCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    if (!userId) return false
    setError(null)

    const { error: leaveError } = await supabase
      .from('category_members')
      .delete()
      .eq('category_id', categoryId)
      .eq('user_id', userId)

    if (leaveError) {
      setError(leaveError.message)
      return false
    }

    await loadCategories()
    return true
  }, [userId, loadCategories])

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  )

  return {
    categories,
    categoryMembers,
    loading,
    error,
    createCategory,
    joinCategory,
    leaveCategory,
    refreshCategories: loadCategories,
    getCategoryById,
    myCategoryIds,
  }
}
