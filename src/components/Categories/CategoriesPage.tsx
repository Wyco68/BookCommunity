import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCategories } from '../../hooks/useCategories'
import { getSignedMediaUrl, SESSION_COVERS_BUCKET } from '../../lib/storage'
import type { ReadingSession } from '../../types'

interface CategoriesPageProps {
  userId: string
}

interface SessionWithCover extends ReadingSession {
  coverSignedUrl?: string | null
}

export function CategoriesPage({ userId }: CategoriesPageProps) {
  const { categories, loading, error } = useCategories({ userId })

  const navigate = useNavigate()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [categorySessions, setCategorySessions] = useState<SessionWithCover[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const sessionsRequestIdRef = useRef(0)
  const autoSelectedRef = useRef(false)

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null

  // Auto-select "Action" (or first category) once categories load
  useEffect(() => {
    if (autoSelectedRef.current || categories.length === 0) return
    autoSelectedRef.current = true
    const action = categories.find((c) => c.name === 'Action') ?? categories[0]
    setSelectedCategoryId(action.id)
  }, [categories])

  const loadCategorySessions = useCallback(async (categoryId: number) => {
    const requestId = sessionsRequestIdRef.current + 1
    sessionsRequestIdRef.current = requestId
    setLoadingSessions(true)
    setSessionsError(null)
    setCategorySessions([])

    const { data, error } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('category_id', categoryId)
      .eq('visibility', 'public')
      .eq('status_type', 'ongoing')
      .order('created_at', { ascending: false })

    if (sessionsRequestIdRef.current !== requestId) return

    if (error) {
      setSessionsError(error.message)
      setLoadingSessions(false)
      return
    }

    if (!data || data.length === 0) {
      setCategorySessions([])
      setLoadingSessions(false)
      return
    }

    const sessionsData = data as ReadingSession[]

    const sessionsWithCovers = await Promise.all(
      sessionsData.map(async (session) => {
        if (!session.cover_image_path) return { ...session, coverSignedUrl: null }
        const signedUrl = await getSignedMediaUrl(session.cover_image_path, SESSION_COVERS_BUCKET)
        return { ...session, coverSignedUrl: signedUrl }
      }),
    )

    if (sessionsRequestIdRef.current !== requestId) return
    setCategorySessions(sessionsWithCovers)
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
                onClick={() => setSelectedCategoryId(cat.id)}
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
              <h3>{selectedCategory.name}</h3>
              {selectedCategory.description ? (
                <p className="subtle">{selectedCategory.description}</p>
              ) : null}
            </div>

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
                    className="session-item session-card session-card-clickable"
                    onClick={() => navigate(`/session/${session.id}`)}
                  >
                    <div className="session-card-cols">
                      <div className="session-card-col-cover" aria-hidden="true">
                        {session.coverSignedUrl ? (
                          <img
                            className="session-card-cover-image"
                            src={session.coverSignedUrl}
                            alt={`${session.book_title} cover`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="session-card-cover-empty">
                            <span className="session-card-no-cover-icon">📖</span>
                          </div>
                        )}
                      </div>

                      <div className="session-card-col-info">
                        <div className="session-heading">
                          <h3 className="session-card-title">{session.book_title}</h3>
                          <span className="pill">{session.visibility}</span>
                        </div>
                        <p className="subtle session-card-author">by {session.book_author}</p>

                        <div className="session-meta-grid">
                          <div className="session-meta-item">
                            <span className="session-meta-label">Chapters</span>
                            <span className="session-meta-value">
                              {session.status_type === 'completed' ? 'Completed' : session.total_chapters}
                            </span>
                          </div>
                        </div>

                        {session.description ? (
                          <p className="muted session-card-desc">{session.description}</p>
                        ) : null}
                      </div>
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
