import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deleteSessionMediaForSession, getSignedMediaUrl } from '../lib/storage'
import { useSessionDetail } from '../hooks/useSessionDetail'
import { useMediaUpload } from '../hooks/useMediaUpload'
import { buildLatestChapterByUser, buildCommentMeta } from '../lib/sessionState'
import { SessionDetailPanel, type SessionDetailPanelTranslations } from '../components/SessionDetailPanel'
import { ConfirmModal } from '../components/ConfirmModal'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { Comment, ReadingSession, SessionJoinRequest, SessionMembership } from '../types'

const LANGUAGE_STORAGE_KEY = 'bookcom-language'

function getLanguage(): Language {
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (saved === 'de' || saved === 'my') return saved
  return 'en'
}

interface SessionDetailPageProps {
  userId: string
  onSessionDeleted?: (sessionId: string) => void
}

export function SessionDetailPage({ userId, onSessionDeleted }: SessionDetailPageProps) {
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
  const [activeChapter, setActiveChapter] = useState(1)
  const [activeChapterMedia, setActiveChapterMedia] = useState<{
    file_name: string
    mime_type: string
    media_type: 'image' | 'book_file'
  } | null>(null)
  const [activeChapterUrl, setActiveChapterUrl] = useState<string | null>(null)
  const [loadingChapter, setLoadingChapter] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

  const detail = useSessionDetail()
  const sessionMedia = useMediaUpload({
    sessionId: sessionId ?? null,
    userId: userId || null,
    sessionOwnerId: session?.creator_id ?? null,
    totalChapters: session?.total_chapters ?? 0,
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
    return () => { alive = false }
  }, [userId])

  // Load session + membership
  useEffect(() => {
    if (!sessionId) return
    setLoadingSession(true)
    Promise.all([
      supabase.from('reading_sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('session_members')
        .select('session_id,user_id,role')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]).then(([sessionResult, memberResult]) => {
      if (sessionResult.data) setSession(sessionResult.data as ReadingSession)
      if (memberResult.data) setMembership(memberResult.data as SessionMembership)
      setLoadingSession(false)
    })
  }, [sessionId, userId])

  // Load detail + media meta (lightweight)
  useEffect(() => {
    if (!sessionId) return
    void detail.loadDetail(sessionId)
    void sessionMedia.loadMediaMeta()
  }, [sessionId])

  // Realtime
  useEffect(() => {
    if (!userId || !sessionId) return

    const channel = supabase
      .channel(`session-detail-${sessionId}`)
      // Comments: append new rows instantly; only reload on update/delete
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const newComment = payload.new as Comment
          await detail.ensureProfile(newComment.user_id)
          detail.appendComment(newComment)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        () => { void detail.loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
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
          supabase
            .from('session_members')
            .select('session_id,user_id,role')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .maybeSingle()
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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_media', filter: `session_id=eq.${sessionId}` },
        () => { void sessionMedia.loadMediaMeta() },
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
  const maxProgressChapter = Math.min(
    session?.total_chapters ?? 0,
    sessionMedia.maxUploadedChapter,
  )
  const leaveSessionDisabled = Boolean(membership?.role === 'owner' && myMembershipCount === 1)

  const loadChapterMedia = useCallback(
    async (chapterNumber: number) => {
      if (!sessionId) return
      setLoadingChapter(true)

      const { data } = await supabase
        .from('session_media')
        .select('file_name,mime_type,media_type,file_path')
        .eq('session_id', sessionId)
        .eq('chapter_number', chapterNumber)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!data) {
        setActiveChapterMedia(null)
        setActiveChapterUrl(null)
        setLoadingChapter(false)
        return
      }

      const signed = await getSignedMediaUrl(data.file_path)
      setActiveChapterMedia({
        file_name: data.file_name,
        mime_type: data.mime_type,
        media_type: data.media_type,
      })
      setActiveChapterUrl(signed)
      setLoadingChapter(false)
    },
    [sessionId],
  )

  useEffect(() => {
    if (!session || !membership || !userId) return
    setMyChapterDraft(myLatestChapter > 0 ? myLatestChapter : 1)
  }, [session?.id, membership, userId, myLatestChapter])

  useEffect(() => {
    if (!sessionId || sessionMedia.maxUploadedChapter < 1) return
    setActiveChapter(1)
    void loadChapterMedia(1)
  }, [sessionId, sessionMedia.maxUploadedChapter, loadChapterMedia])

  const handleSubmitComment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!userId || !sessionId || !commentDraft.trim()) return
      await detail.submitComment(sessionId, userId, commentDraft)
      setCommentDraft('')
    },
    [userId, sessionId, commentDraft, detail],
  )

  const handleToggleLike = useCallback(
    async (commentId: string) => {
      if (!userId || !sessionId) return
      await detail.toggleLike(sessionId, userId, commentId)
    },
    [userId, sessionId, detail],
  )

  const handleApproveJoinRequest = useCallback(
    async (request: SessionJoinRequest) => {
      if (!sessionId || !userId) return
      await detail.approveRequest(sessionId, request)
    },
    [sessionId, userId, detail],
  )

  const handleRejectJoinRequest = useCallback(
    async (request: SessionJoinRequest) => {
      if (!sessionId || !userId) return
      await detail.rejectRequest(sessionId, request)
    },
    [sessionId, userId, detail],
  )

  const handleLeaveSession = useCallback(async () => {
    if (!sessionId || !userId || !membership) return
    setLeaving(true)
    const { error } = await supabase
      .from('session_members')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    setLeaving(false)
    if (!error) navigate(-1)
  }, [sessionId, userId, membership, navigate])

  const handleUpdateVisibility = useCallback(async (newVisibility: 'public' | 'private') => {
    if (!sessionId || !isOwner) return
    setUpdatingVisibility(true)
    const { error } = await supabase
      .from('reading_sessions')
      .update({ visibility: newVisibility })
      .eq('id', sessionId)
    setUpdatingVisibility(false)
    if (!error) setSession((prev) => prev ? { ...prev, visibility: newVisibility } : prev)
  }, [sessionId, isOwner])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!sessionId || !isOwner || memberId === userId) return
    setRemovingMemberId(memberId)
    await supabase.from('session_members').delete().eq('session_id', sessionId).eq('user_id', memberId)
    setRemovingMemberId(null)
    void detail.loadDetail(sessionId)
  }, [sessionId, isOwner, userId, detail])

  const handleDeleteSession = useCallback(async () => {
    if (!sessionId || !isOwner) return
    setDeletingSession(true)
    setDeleteError(null)

    const { data: mediaRows, error: mediaLoadError } = await supabase
      .from('session_media')
      .select('file_path')
      .eq('session_id', sessionId)

    if (mediaLoadError) {
      setDeleteError(mediaLoadError.message)
      setDeletingSession(false)
      return
    }

    const filePaths = (mediaRows ?? [])
      .map((row) => row.file_path)
      .filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0)

    const storageDeleteError = await deleteSessionMediaForSession(sessionId, filePaths)
    if (storageDeleteError) {
      setDeleteError(`Storage cleanup failed: ${storageDeleteError}`)
      setDeletingSession(false)
      return
    }

    const { error } = await supabase.from('reading_sessions').delete().eq('id', sessionId)
    setDeletingSession(false)
    if (!error) {
      onSessionDeleted?.(sessionId)
      navigate(-1)
      return
    }
    setDeleteError(error.message)
  }, [sessionId, isOwner, navigate, onSessionDeleted])

  const handleSaveMyProgress = useCallback(async () => {
    if (!session || !userId || !membership || !sessionId) return
    if (myChapterDraft < 1 || myChapterDraft > maxProgressChapter) return
    setSavingProgress(true)
    const { error } = await supabase.from('progress_updates').insert({
      session_id: session.id,
      user_id: userId,
      chapter_number: myChapterDraft,
    })
    setSavingProgress(false)
    if (!error) void detail.loadDetail(sessionId)
  }, [session, userId, membership, sessionId, myChapterDraft, maxProgressChapter, detail])

  if (loadingSession) {
    return (
      <section className="stack">
        <p className="subtle">{t.sessions.loadingSession}</p>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="stack">
        <article className="card stack">
          <p className="subtle">{t.sessions.sessionNotFound}</p>
          <button type="button" className="btn-back-compact" onClick={() => navigate(-1)}>
            ⬅ {t.common.back}
          </button>
        </article>
      </section>
    )
  }

  return (
    <section className="stack">
      <div className="detail-back-bar">
        <button type="button" className="btn-back-compact" onClick={() => navigate(-1)}>
          ⬅ {t.common.back}
        </button>
      </div>

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
        mediaUploading={sessionMedia.uploading}
        mediaError={sessionMedia.error}
        onUploadMedia={sessionMedia.uploadMedia}
        canUploadMedia={sessionMedia.canUpload}
        mediaCount={sessionMedia.mediaCount}
        mediaLimit={sessionMedia.mediaLimit}
        nextChapter={sessionMedia.nextChapter}
        currentUserId={userId}
        readChaptersByUsers={readChaptersByUsers}
        onLeaveSession={handleLeaveSession}
        leavingSession={leaving}
        myProgressChapterDraft={myChapterDraft}
        onMyProgressChapterDraftChange={(chapter) => setMyChapterDraft(chapter)}
        onSaveMyProgress={handleSaveMyProgress}
        savingMyProgress={savingProgress}
        leaveSessionDisabled={leaveSessionDisabled}
        maxProgressChapter={maxProgressChapter}
        activeChapter={activeChapter}
        maxChapter={sessionMedia.maxUploadedChapter}
        activeChapterMedia={activeChapterMedia}
        activeChapterUrl={activeChapterUrl}
        loadingChapter={loadingChapter}
        onPrevChapter={async () => {
          if (activeChapter <= 1) return
          const next = activeChapter - 1
          setActiveChapter(next)
          await loadChapterMedia(next)
        }}
        onNextChapter={async () => {
          if (activeChapter >= sessionMedia.maxUploadedChapter) return
          const next = activeChapter + 1
          setActiveChapter(next)
          await loadChapterMedia(next)
        }}
        onUpdateVisibility={handleUpdateVisibility}
        updatingVisibility={updatingVisibility}
        onRemoveMember={handleRemoveMember}
        removingMemberId={removingMemberId}
        onDeleteSession={() => setShowDeleteConfirm(true)}
      />
      {deleteError ? <p className="error">{deleteError}</p> : null}

      {showDeleteConfirm ? (
        <ConfirmModal
          message={t.manage.deleteConfirm}
          confirmLabel={deletingSession ? t.common.working : t.common.delete}
          cancelLabel={t.common.cancel}
          dangerous
          onConfirm={() => {
            setShowDeleteConfirm(false)
            void handleDeleteSession()
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      ) : null}
    </section>
  )
}
