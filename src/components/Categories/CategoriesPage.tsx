import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyCreate } from '../../lib/notifications'
import { useCategories } from '../../hooks/useCategories'
import { getSignedMediaUrlMap, SESSION_COVERS_BUCKET } from '../../lib/storage'
import { translations } from '../../i18n'
import type { Language } from '../../i18n'
import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../../types'
import { SessionCard } from '../SessionCard'
import { JoinSessionModal } from '../JoinSessionModal'

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

function getLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (saved === 'de' || saved === 'my') return saved
  return 'en'
}

interface CategoriesPageProps {
  userId: string
}

interface SessionWithCover extends ReadingSession {
  coverSignedUrl?: string | null
}

const CATEGORY_PAGE_SIZE = 20

export function CategoriesPage({ userId }: CategoriesPageProps) {
  const { categories, loading, error } = useCategories({ userId })
  const t = translations[getLanguage()]

  const navigate = useNavigate()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [categorySessions, setCategorySessions] = useState<SessionWithCover[]>([])
  const [memberships, setMemberships] = useState<Record<string, SessionMembership>>({})
  const [requestStatuses, setRequestStatuses] = useState<Record<string, SessionJoinRequest['status']>>({})
  const [joinTarget, setJoinTarget] = useState<SessionWithCover | null>(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const sessionsRequestIdRef = useRef(0)
  const autoSelectedRef = useRef(false)
  const cursorRef = useRef<{ created_at: string; id: string } | null>(null)

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
    setHasMore(false)
    cursorRef.current = null

    const { data, error } = await supabase
      .from('reading_sessions')
      .select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at')
      .eq('category_id', categoryId)
      .eq('visibility', 'public')
      .eq('status_type', 'ongoing')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CATEGORY_PAGE_SIZE)

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
    const sessionIds = sessionsData.map((s) => s.id)
    const last = sessionsData[sessionsData.length - 1]
    cursorRef.current = { created_at: last.created_at, id: last.id }
    setHasMore(sessionsData.length === CATEGORY_PAGE_SIZE)

    // Batch-sign all cover URLs, fetch this user's memberships + join-request
    // statuses in parallel (single round-trip).
    const coverPaths = sessionsData
      .map((s) => s.cover_image_path)
      .filter((p): p is string => Boolean(p))

    const [signedMap, membershipsResult, requestsResult] = await Promise.all([
      coverPaths.length > 0
        ? getSignedMediaUrlMap(coverPaths, SESSION_COVERS_BUCKET)
        : Promise.resolve({} as Record<string, string>),
      sessionIds.length > 0 && userId
        ? supabase
            .from('session_members')
            .select('session_id,user_id,role')
            .in('session_id', sessionIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as SessionMembership[], error: null }),
      sessionIds.length > 0 && userId
        ? supabase
            .from('session_join_requests')
            .select('session_id,status')
            .in('session_id', sessionIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as { session_id: string; status: SessionJoinRequest['status'] }[], error: null }),
    ])

    if (sessionsRequestIdRef.current !== requestId) return

    const sessionsWithCovers = sessionsData.map((session) => ({
      ...session,
      coverSignedUrl: session.cover_image_path
        ? (signedMap[session.cover_image_path] ?? null)
        : null,
    }))

    const membershipLookup: Record<string, SessionMembership> = {}
    for (const m of (membershipsResult.data ?? []) as SessionMembership[]) {
      membershipLookup[m.session_id] = m
    }

    const requestLookup: Record<string, SessionJoinRequest['status']> = {}
    for (const r of (requestsResult.data ?? []) as { session_id: string; status: SessionJoinRequest['status'] }[]) {
      requestLookup[r.session_id] = r.status
    }

    setCategorySessions(sessionsWithCovers)
    setMemberships(membershipLookup)
    setRequestStatuses(requestLookup)
    setLoadingSessions(false)
  }, [userId])

  useEffect(() => {
    if (selectedCategoryId) {
      void loadCategorySessions(selectedCategoryId)
    } else {
      sessionsRequestIdRef.current += 1
      setSessionsError(null)
      setCategorySessions([])
      setMemberships({})
      setRequestStatuses({})
      setHasMore(false)
      cursorRef.current = null
    }
  }, [selectedCategoryId, loadCategorySessions])

  const loadMoreCategorySessions = useCallback(async () => {
    if (!selectedCategoryId || loadingMore || loadingSessions || !hasMore) return
    const cursor = cursorRef.current
    if (!cursor) return

    setLoadingMore(true)

    const { data, error: pageError } = await supabase
      .from('reading_sessions')
      .select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at')
      .eq('category_id', selectedCategoryId)
      .eq('visibility', 'public')
      .eq('status_type', 'ongoing')
      .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(CATEGORY_PAGE_SIZE)

    if (pageError) {
      setSessionsError(pageError.message)
      setLoadingMore(false)
      return
    }

    const pageData = (data ?? []) as ReadingSession[]
    setHasMore(pageData.length === CATEGORY_PAGE_SIZE)

    if (pageData.length === 0) {
      setLoadingMore(false)
      return
    }

    const newLast = pageData[pageData.length - 1]
    cursorRef.current = { created_at: newLast.created_at, id: newLast.id }

    const coverPaths = pageData
      .map((s) => s.cover_image_path)
      .filter((p): p is string => Boolean(p))
    const sessionIds = pageData.map((s) => s.id)

    const [signedMap, membershipsResult, requestsResult] = await Promise.all([
      coverPaths.length > 0
        ? getSignedMediaUrlMap(coverPaths, SESSION_COVERS_BUCKET)
        : Promise.resolve({} as Record<string, string>),
      sessionIds.length > 0 && userId
        ? supabase
            .from('session_members')
            .select('session_id,user_id,role')
            .in('session_id', sessionIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as SessionMembership[], error: null }),
      sessionIds.length > 0 && userId
        ? supabase
            .from('session_join_requests')
            .select('session_id,status')
            .in('session_id', sessionIds)
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as { session_id: string; status: SessionJoinRequest['status'] }[], error: null }),
    ])

    const additions = pageData.map((s) => ({
      ...s,
      coverSignedUrl: s.cover_image_path ? (signedMap[s.cover_image_path] ?? null) : null,
    }))

    setCategorySessions((prev) => {
      const seen = new Set(prev.map((s) => s.id))
      const filtered = additions.filter((s) => !seen.has(s.id))
      return filtered.length === 0 ? prev : [...prev, ...filtered]
    })
    setMemberships((prev) => {
      const next = { ...prev }
      for (const m of (membershipsResult.data ?? []) as SessionMembership[]) {
        next[m.session_id] = m
      }
      return next
    })
    setRequestStatuses((prev) => {
      const next = { ...prev }
      for (const r of (requestsResult.data ?? []) as { session_id: string; status: SessionJoinRequest['status'] }[]) {
        next[r.session_id] = r.status
      }
      return next
    })
    setLoadingMore(false)
  }, [selectedCategoryId, loadingMore, loadingSessions, hasMore, userId])

  const handleConfirmJoin = useCallback(async () => {
    if (!joinTarget || !userId) return
    setJoinBusy(true)

    if (joinTarget.join_policy === 'request') {
      const { error: requestError } = await supabase
        .from('session_join_requests')
        .upsert(
          { session_id: joinTarget.id, user_id: userId, status: 'pending' },
          { onConflict: 'session_id,user_id' },
        )
      setJoinBusy(false)
      if (requestError) {
        setSessionsError(requestError.message)
        return
      }
      setRequestStatuses((prev) => ({ ...prev, [joinTarget.id]: 'pending' }))
      setJoinTarget(null)
      notifyCreate({ type: 'JOIN_REQUESTED', sessionId: joinTarget.id, actorId: userId })
      return
    }

    const { error: joinError } = await supabase.from('session_members').insert({
      session_id: joinTarget.id,
      user_id: userId,
      role: 'member',
    })
    setJoinBusy(false)
    if (joinError) {
      setSessionsError(joinError.message)
      return
    }
    setMemberships((prev) => ({
      ...prev,
      [joinTarget.id]: { session_id: joinTarget.id, user_id: userId, role: 'member' },
    }))
    setJoinTarget(null)
    notifyCreate({ type: 'SESSION_JOINED', sessionId: joinTarget.id, actorId: userId })
    navigate(`/session/${joinTarget.id}`)
  }, [joinTarget, userId, navigate])

  return (
    <section className="page-tight">
      <article className="card page-tight-card">
        <h2>{t.categories.title}</h2>

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="subtle">{t.categories.loading}</p> : null}

        {!loading && categories.length === 0 ? (
          <p className="subtle">{t.categories.noCategories}</p>
        ) : null}

        {categories.length > 0 ? (
          <div className="category-tab-bar page-tight-tabs" role="tablist" aria-label={t.categories.categoryFilter}>
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
            {loadingSessions ? <p className="subtle">{t.categories.loadingSessions}</p> : null}
            {!loadingSessions && categorySessions.length === 0 ? (
              <p className="subtle">{t.categories.noSessions}</p>
            ) : null}

            {!loadingSessions && categorySessions.length > 0 ? (
              <>
                <ul className="session-list session-grid page-tight-session-list">
                  {categorySessions.map((session) => {
                  const membership = memberships[session.id]
                  const requestStatus = requestStatuses[session.id]
                  const isMember = Boolean(membership)
                  return (
                    <SessionCard
                      key={session.id}
                      t={t}
                      session={session}
                      membership={membership}
                      requestStatus={requestStatus}
                      categories={selectedCategory ? [selectedCategory.name] : []}
                      coverUrl={session.coverSignedUrl ?? null}
                      busy={joinBusy && joinTarget?.id === session.id}
                      onClick={() => {
                        if (isMember) {
                          navigate(`/session/${session.id}`)
                        } else if (requestStatus !== 'pending') {
                          setJoinTarget(session)
                        }
                      }}
                      onJoinClick={!isMember ? () => setJoinTarget(session) : undefined}
                    />
                  )
                  })}
                </ul>

                {hasMore ? (
                  <div className="load-more-row">
                    <button
                      type="button"
                      className="secondary"
                      disabled={loadingMore}
                      onClick={() => { void loadMoreCategorySessions() }}
                    >
                      {loadingMore ? t.sessions.loadingMore : t.sessions.loadMore}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </article>

      {joinTarget ? (
        <JoinSessionModal
          session={joinTarget}
          loading={joinBusy}
          onConfirm={() => { void handleConfirmJoin() }}
          onCancel={() => setJoinTarget(null)}
          titleLabel={t.sessions.joinModalTitle}
          descOpen={t.sessions.joinModalDescOpen}
          descRequest={t.sessions.joinModalDescRequest}
          confirmLabel={joinTarget.join_policy === 'request' ? t.sessions.requestToJoin : t.sessions.joinSession}
          cancelLabel={t.common.cancel}
        />
      ) : null}
    </section>
  )
}
