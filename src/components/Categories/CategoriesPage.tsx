import { useCallback, useEffect, useRef, useState } from 'react'
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
    loading,
    error,
  } = useCategories({ userId })

  const navigate = useNavigate()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [categorySessions, setCategorySessions] = useState<ReadingSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const sessionsRequestIdRef = useRef(0)

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null

  const loadCategorySessions = useCallback(async (categoryId: number) => {
    const requestId = sessionsRequestIdRef.current + 1
    sessionsRequestIdRef.current = requestId
    setLoadingSessions(true)
    setSessionsError(null)
    setCategorySessions([])

    const { data: scData, error: scError } = await supabase
      .from('session_categories')
      .select('reading_sessions!inner(*)')
      .eq('category_id', categoryId)
      .eq('reading_sessions.visibility', 'public')
      .order('created_at', { ascending: false, referencedTable: 'reading_sessions' })

    if (sessionsRequestIdRef.current !== requestId) {
      return
    }

    if (scError) {
      setSessionsError(scError.message)
      setLoadingSessions(false)
      return
    }

    if (!scData || scData.length === 0) {
      setCategorySessions([])
      setLoadingSessions(false)
      return
    }

    const sessionsData = (scData as { reading_sessions: ReadingSession }[])
      .map((row) => row.reading_sessions)
    setCategorySessions(sessionsData)
    setLoadingSessions(false)
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      void loadCategorySessions(selectedCategoryId)
    } else {
      sessionsRequestIdRef.current += 1
      setSessionsError(null)
      setCategorySessions([])
    }
  }, [selectedCategoryId, loadCategorySessions])

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
                <span className="pill">System Category</span>
              </div>
            </div>

            <h3>Sessions</h3>
            {sessionsError ? <p className="error">{sessionsError}</p> : null}
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
