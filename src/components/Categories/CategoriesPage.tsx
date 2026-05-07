import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCategories } from '../../hooks/useCategories'
import type { ReadingSession } from '../../types'

interface CategoriesPageProps {
  userId: string
}

export function CategoriesPage({ userId }: CategoriesPageProps) {
  const {
    categories,
    categoryMembers,
    loading,
    error,
    joinCategory,
    leaveCategory,
  } = useCategories({ userId })

  const navigate = useNavigate()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [categorySessions, setCategorySessions] = useState<ReadingSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null
  const selectedIsMember = selectedCategoryId ? Boolean(categoryMembers[selectedCategoryId]) : false

  const loadCategorySessions = useCallback(async (categoryId: string) => {
    setLoadingSessions(true)
    const { data: scData } = await supabase
      .from('session_categories')
      .select('session_id')
      .eq('category_id', categoryId)

    if (!scData || scData.length === 0) {
      setCategorySessions([])
      setLoadingSessions(false)
      return
    }

    const sessionIds = scData.map((sc: { session_id: string }) => sc.session_id)
    const { data: sessionsData } = await supabase
      .from('reading_sessions')
      .select('*')
      .in('id', sessionIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setCategorySessions((sessionsData ?? []) as ReadingSession[])
    setLoadingSessions(false)
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      void loadCategorySessions(selectedCategoryId)
    } else {
      setCategorySessions([])
    }
  }, [selectedCategoryId, loadCategorySessions])

  async function handleJoin(categoryId: string) {
    setBusyCategoryId(categoryId)
    await joinCategory(categoryId)
    setBusyCategoryId(null)
  }

  async function handleLeave(categoryId: string) {
    setBusyCategoryId(categoryId)
    await leaveCategory(categoryId)
    setBusyCategoryId(null)
  }

  return (
    <section className="page-tight">
      <article className="card page-tight-card">
        <h2>Categories</h2>
        <p className="subtle">Browse reading sessions by category.</p>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="subtle">Loading categories…</p> : null}

        {!loading && categories.length === 0 ? (
          <p className="subtle">No categories available yet.</p>
        ) : null}

        {categories.length > 0 ? (
          <div className="category-tab-bar page-tight-tabs" role="tablist" aria-label="Category filter">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategoryId === cat.id}
                className={`category-tab ${selectedCategoryId === cat.id ? 'category-tab-active' : ''}`}
                onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        ) : null}

        {selectedCategory ? (
          <>
            <hr className="page-tight-rule" />
            <div className="detail-header">
              <div>
                <h3>{selectedCategory.name}</h3>
                {selectedCategory.description ? (
                  <p className="subtle">{selectedCategory.description}</p>
                ) : null}
              </div>
              <div className="page-tight-actions">
                <span className="pill">{selectedCategory.visibility}</span>
                {selectedIsMember ? (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyCategoryId === selectedCategory.id}
                    onClick={() => { void handleLeave(selectedCategory.id) }}
                  >
                    {busyCategoryId === selectedCategory.id ? 'Leaving…' : 'Leave'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busyCategoryId === selectedCategory.id}
                    onClick={() => { void handleJoin(selectedCategory.id) }}
                  >
                    {busyCategoryId === selectedCategory.id ? 'Joining…' : 'Join'}
                  </button>
                )}
              </div>
            </div>

            <h3>Sessions</h3>
            {loadingSessions ? <p className="subtle">Loading sessions…</p> : null}
            {!loadingSessions && categorySessions.length === 0 ? (
              <p className="subtle">No sessions in this category yet.</p>
            ) : null}

            {!loadingSessions && categorySessions.length > 0 ? (
              <ul className="session-list page-tight-session-list">
                {categorySessions.map((session) => (
                  <li
                    key={session.id}
                    className="session-item session-card-clickable"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div className="page-tight-session-inner">
                      <div className="session-heading">
                        <h3>{session.book_title}</h3>
                        <span className="pill">{session.visibility}</span>
                      </div>
                      <p className="subtle">by {session.book_author}</p>
                      <div className="session-meta-grid">
                        <div className="session-meta-item">
                          <span className="session-meta-label">Chapters</span>
                          <span className="session-meta-value">{session.total_chapters}</span>
                        </div>
                      </div>
                      {session.description ? <p className="muted">{session.description}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </article>
    </section>
  )
}
