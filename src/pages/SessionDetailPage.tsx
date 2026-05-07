import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessionDetail } from '../hooks/useSessionDetail'
import { useMediaUpload } from '../hooks/useMediaUpload'
import { buildLatestChapterByUser, buildCommentMeta } from '../lib/sessionState'
import { SessionDetailPanel, type SessionDetailPanelTranslations } from '../components/SessionDetailPanel'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { ReadingSession, SessionJoinRequest, SessionMembership } from '../types'

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

function getLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return saved === 'my' ? 'my' : 'en'
}

interface SessionDetailPageProps {
  userId: string
}

export function SessionDetailPage({ userId }: SessionDetailPageProps) {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const t: SessionDetailPanelTranslations = translations[getLanguage()]

  const [session, setSession] = useState<ReadingSession | null>(null)
  const [membership, setMembership] = useState<SessionMembership | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [loadingSession, setLoadingSession] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [myChapterDraft, setMyChapterDraft] = useState(1)
  const [savingProgress, setSavingProgress] = useState(false)
  const [myMembershipCount, setMyMembershipCount] = useState(0)

  const detail = useSessionDetail()
  const sessionMedia = useMediaUpload({
    sessionId: sessionId ?? null,
    userId: userId || null,
  })

  const isMember = Boolean(membership)
  const isOwner = Boolean(session && session.creator_id === userId)

  useEffect(() => {
    if (!userId) return
    let alive = true
    void supabase
      .from('session_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => {
        if (alive) setMyMembershipCount(count ?? 0)
      })
    return () => {
      alive = false
    }
  }, [userId])

  // Load session + membership
  useEffect(() => {
    if (!sessionId) return
    setLoadingSession(true)

    Promise.all([
      supabase.from('reading_sessions').select('*').eq('id', sessionId).single(),
      supabase.from('session_members').select('session_id,user_id,role').eq('session_id', sessionId).eq('user_id', userId).maybeSingle(),
    ]).then(([sessionResult, memberResult]) => {
      if (sessionResult.data) setSession(sessionResult.data as ReadingSession)
      if (memberResult.data) setMembership(memberResult.data as SessionMembership)
      setLoadingSession(false)
    })
  }, [sessionId, userId])

  // Load detail
  useEffect(() => {
    if (!sessionId) return
    void detail.loadDetail(sessionId)
    void sessionMedia.loadMedia()
  }, [sessionId])

  // Realtime
  useEffect(() => {
    if (!userId || !sessionId) return

    const channel = supabase
      .channel(`session-detail-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        () => { void detail.loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_updates', filter: `session_id=eq.${sessionId}` },
        () => { void detail.loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${sessionId}` },
        () => {
          void detail.loadDetail(sessionId)
          // Refresh membership status
          supabase.from('session_members').select('session_id,user_id,role').eq('session_id', sessionId).eq('user_id', userId).maybeSingle()
            .then(({ data }) => setMembership(data as SessionMembership | null))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes' },
        () => { void detail.loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_join_requests', filter: `session_id=eq.${sessionId}` },
        () => { void detail.loadDetail(sessionId) },
      )

    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, sessionId])

  const memberLatestProgress = useMemo(() => buildLatestChapterByUser(detail.progress), [detail.progress])
  const commentMeta = useMemo(() => buildCommentMeta(detail.likes, userId), [detail.likes, userId])
  const pendingRequests = useMemo(
    () => detail.joinRequests.filter((r) => r.status === 'pending'),
    [detail.joinRequests],
  )
  const readChaptersByUsers = useMemo(
    () => Object.values(memberLatestProgress).reduce((sum, chapter) => sum + chapter, 0),
    [memberLatestProgress],
  )

  const myLatestChapter = userId ? (memberLatestProgress[userId] ?? 0) : 0
  const leaveSessionDisabled = Boolean(membership?.role === 'owner' && myMembershipCount === 1)

  useEffect(() => {
    if (!session || !membership || !userId) return
    setMyChapterDraft(myLatestChapter > 0 ? myLatestChapter : 1)
  }, [session?.id, membership, userId, myLatestChapter])

  const handleSubmitComment = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId || !sessionId || !commentDraft.trim()) return
    await detail.submitComment(sessionId, userId, commentDraft)
    setCommentDraft('')
  }, [userId, sessionId, commentDraft, detail])

  const handleToggleLike = useCallback(async (commentId: string) => {
    if (!userId || !sessionId) return
    await detail.toggleLike(sessionId, userId, commentId)
  }, [userId, sessionId, detail])

  const handleApproveJoinRequest = useCallback(async (request: SessionJoinRequest) => {
    if (!sessionId || !userId) return
    await detail.approveRequest(sessionId, request)
  }, [sessionId, userId, detail])

  const handleRejectJoinRequest = useCallback(async (request: SessionJoinRequest) => {
    if (!sessionId || !userId) return
    await detail.rejectRequest(sessionId, request)
  }, [sessionId, userId, detail])

  const handleLeaveSession = useCallback(async () => {
    if (!sessionId || !userId || !membership) return
    setLeaving(true)
    const { error } = await supabase
      .from('session_members')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    setLeaving(false)
    if (!error) {
      navigate(-1)
    }
  }, [sessionId, userId, membership, navigate])

  const handleSaveMyProgress = useCallback(async () => {
    if (!session || !userId || !membership || !sessionId) return
    if (myChapterDraft < 1 || myChapterDraft > session.total_chapters) return
    setSavingProgress(true)
    const { error } = await supabase.from('progress_updates').insert({
      session_id: session.id,
      user_id: userId,
      chapter_number: myChapterDraft,
    })
    setSavingProgress(false)
    if (!error) {
      void detail.loadDetail(sessionId)
    }
  }, [session, userId, membership, sessionId, myChapterDraft, detail])

  if (loadingSession) {
    return (
      <section className="stack">
        <p className="subtle">Loading session…</p>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="stack">
        <article className="card stack">
          <p className="subtle">Session not found.</p>
          <button type="button" className="btn-back-compact" onClick={() => navigate(-1)}>
            ⬅ back
          </button>
        </article>
      </section>
    )
  }

  return (
    <section className="stack">
      <button type="button" className="btn-back-compact" onClick={() => navigate(-1)}>
        ⬅ back
      </button>

      <SessionDetailPanel
        t={t}
        selectedSession={session}
        selectedIsOwner={isOwner}
        selectedIsMember={isMember}
        loadingSessionDetail={detail.loading}
        sessionMembers={detail.members}
        sessionProfiles={detail.profiles}
        memberLatestProgress={memberLatestProgress}
        pendingRequests={pendingRequests}
        requestBusyId={null}
        commentDraft={commentDraft}
        postingComment={false}
        sessionComments={detail.comments}
        commentMeta={commentMeta}
        likingCommentId={null}
        onApproveJoinRequest={handleApproveJoinRequest}
        onRejectJoinRequest={handleRejectJoinRequest}
        onSubmitComment={handleSubmitComment}
        onCommentDraftChange={setCommentDraft}
        onToggleLike={handleToggleLike}
        media={sessionMedia.media}
        mediaUrls={sessionMedia.mediaUrls}
        mediaLoading={sessionMedia.loading}
        mediaUploading={sessionMedia.uploading}
        mediaError={sessionMedia.error}
        mediaHasMore={sessionMedia.hasMore}
        onUploadMedia={sessionMedia.uploadMedia}
        onRemoveMedia={sessionMedia.removeMedia}
        onLoadMoreMedia={sessionMedia.loadMore}
        currentUserId={userId}
        readChaptersByUsers={readChaptersByUsers}
        onLeaveSession={handleLeaveSession}
        leavingSession={leaving}
        myProgressChapterDraft={myChapterDraft}
        onMyProgressChapterDraftChange={setMyChapterDraft}
        onSaveMyProgress={handleSaveMyProgress}
        savingMyProgress={savingProgress}
        leaveSessionDisabled={leaveSessionDisabled}
      />
    </section>
  )
}
