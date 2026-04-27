import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCategories } from '../../hooks/useCategories'
import {
  CategoryList,
  CreateCategoryForm,
  CategoryDetail,
} from './CategoryComponents'
import type { CategoryMember, Profile } from '../../types'
import { resolveAvatarUrlMap, isRemoteUrl } from '../../lib/avatar'

interface CategoriesPageProps {
  userId: string
}

export function CategoriesPage({ userId }: CategoriesPageProps) {
  const {
    categories,
    categoryMembers,
    loading,
    error,
    createCategory,
    joinCategory,
    leaveCategory,
  } = useCategories({ userId })

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'browse' | 'create'>('browse')
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [detailMembers, setDetailMembers] = useState<CategoryMember[]>([])
  const [detailProfiles, setDetailProfiles] = useState<Record<string, Profile>>({})
  const [detailSessionCount, setDetailSessionCount] = useState(0)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  )

  const selectedIsMember = selectedCategoryId ? Boolean(categoryMembers[selectedCategoryId]) : false
  const selectedIsOwner = selectedCategory ? selectedCategory.creator_id === userId : false

  const loadCategoryDetail = useCallback(async (categoryId: string) => {
    setLoadingDetail(true)

    const [membersResult, sessionCatResult] = await Promise.all([
      supabase
        .from('category_members')
        .select('*')
        .eq('category_id', categoryId),
      supabase
        .from('session_categories')
        .select('id')
        .eq('category_id', categoryId),
    ])

    if (membersResult.error || sessionCatResult.error) {
      setLoadingDetail(false)
      return
    }

    const members = (membersResult.data ?? []) as CategoryMember[]
    setDetailMembers(members)
    setDetailSessionCount((sessionCatResult.data ?? []).length)

    const memberUserIds = members.map((m) => m.user_id)
    if (memberUserIds.length > 0) {
      const profilesResult = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', memberUserIds)

      if (!profilesResult.error) {
        const profiles = (profilesResult.data ?? []) as Profile[]
        const avatarPaths = profiles
          .map((p) => p.avatar_url)
          .filter((url): url is string => Boolean(url) && !isRemoteUrl(url))
        const resolvedAvatars = await resolveAvatarUrlMap(avatarPaths)

        const lookup: Record<string, Profile> = {}
        for (const profile of profiles) {
          if (profile.avatar_url && !isRemoteUrl(profile.avatar_url) && resolvedAvatars[profile.avatar_url]) {
            lookup[profile.id] = { ...profile, avatar_url: resolvedAvatars[profile.avatar_url] }
          } else {
            lookup[profile.id] = profile
          }
        }
        setDetailProfiles(lookup)
      }
    }

    setLoadingDetail(false)
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      void loadCategoryDetail(selectedCategoryId)
    }
  }, [selectedCategoryId, loadCategoryDetail])

  async function handleJoin(categoryId: string) {
    setBusyCategoryId(categoryId)
    await joinCategory(categoryId)
    if (selectedCategoryId === categoryId) {
      await loadCategoryDetail(categoryId)
    }
    setBusyCategoryId(null)
  }

  async function handleLeave(categoryId: string) {
    setBusyCategoryId(categoryId)
    await leaveCategory(categoryId)
    if (selectedCategoryId === categoryId) {
      await loadCategoryDetail(categoryId)
    }
    setBusyCategoryId(null)
  }

  return (
    <section className="stack">
      <article className="card stack">
        <div>
          <h2>Categories</h2>
          <p className="subtle">Browse, join, or create reading categories.</p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="Category views">
          <button
            type="button"
            className={`auth-switch-option ${panelMode === 'browse' ? 'auth-switch-option-active' : ''}`}
            onClick={() => setPanelMode('browse')}
          >
            Browse
          </button>
          <button
            type="button"
            className={`auth-switch-option ${panelMode === 'create' ? 'auth-switch-option-active' : ''}`}
            onClick={() => setPanelMode('create')}
          >
            Create
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {panelMode === 'browse' ? (
          <>
            {loading ? <p className="subtle">Loading categories…</p> : null}
            {!loading && categories.length === 0 ? (
              <p className="subtle">No categories yet. Create one to get started!</p>
            ) : null}
            <CategoryList
              categories={categories}
              categoryMembers={categoryMembers}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              onJoinCategory={handleJoin}
              onLeaveCategory={handleLeave}
              busyCategoryId={busyCategoryId}
            />
          </>
        ) : (
          <CreateCategoryForm
            onCreateCategory={async (name, desc, vis) => {
              setCreating(true)
              const result = await createCategory(name, desc, vis)
              setCreating(false)
              if (result) {
                setPanelMode('browse')
              }
              return result
            }}
            creating={creating}
          />
        )}
      </article>

      {selectedCategoryId ? (
        loadingDetail ? (
          <article className="card stack">
            <p className="subtle">Loading category details…</p>
          </article>
        ) : (
          <CategoryDetail
            category={selectedCategory}
            members={detailMembers}
            profiles={detailProfiles}
            isMember={selectedIsMember}
            isOwner={selectedIsOwner}
            sessionCount={detailSessionCount}
          />
        )
      ) : null}
    </section>
  )
}
