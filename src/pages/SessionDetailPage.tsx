import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notifyCreate } from '../lib/notifications'
import {
  deleteSessionMediaForSession,
  deleteSessionCover,
  getSignedMediaUrl,
} from '../lib/storage'
import { useSessionDetail } from '../hooks/useSessionDetail'
import { useMediaUpload } from '../hooks/useMediaUpload'
import { buildLatestChapterByUser, buildCommentMeta } from '../lib/sessionState'
import { SessionDetailPanel, type SessionDetailPanelTranslations, type SessionDetailTab } from '../components/SessionDetailPanel'
import { ConfirmModal } from '../components/ConfirmModal'
import { JoinSessionModal } from '../components/JoinSessionModal'
import { PageSpinner } from '../components/Spinner'
import { translations } from '../i18n'
import type { Language } from '../i18n'
import type { Comment, ReadingSession, SessionJoinRequest, SessionMembership } from '../types'
import { ArrowLeft } from 'lucide-react'
import { useMotion } from '../hooks/useMotion'
import { useSlidingPill } from '../hooks/useSlidingPill'

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
  const [savingChapterProgress, setSavingChapterProgress] = useState(false)
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
  const [removeMemberConfirmId, setRemoveMemberConfirmId] = useState<string | null>(null)
  const settingsNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SessionDetailTab>('media')
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joiningSession, setJoiningSession] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [myJoinRequestStatus, setMyJoinRequestStatus] = useState<SessionJoinRequest['status'] | null>(null)
  
  const canAnimate = useMotion()
  const { containerRef: tabRef, pillStyle: tabPill } = useSlidingPill<HTMLDivElement>('.auth-switch-option-active')

  const detail = useSessionDetail()
  const sessionMedia = useMediaUpload({
    sessionId: sessionId ?? null,
    userId: userId || null,
    sessionOwnerId: session?.creator_id ?? null,
    totalChapters: session?.total_chapters ?? 0,
  })

  // Stable refs for exhaustive-deps compliance
  const { loadDetail, ensureProfile, appendComment, clearDetail } = detail
  const { loadMediaMeta } = sessionMedia

  const isMember = Boolean(membership)
  const isOwner = Boolean(session && session.creator_id === userId)
  const canAccessSessionContent = !loadingSession && (isMember || isOwner)

  useEffect(() => {
    return () => {
      if (settingsNoticeTimeoutRef.current) {
        clearTimeout(settingsNoticeTimeoutRef.current)
        settingsNoticeTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    // session_members PK is (session_id, user_id); no `id` column exists.
    // Use `user_id` for the count query (existing column).
    void supabase
      .from('session_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => {
        if (alive) setMyMembershipCount(count ?? 0)
      })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    if (!sessionId) return
    setLoadingSession(true)
    Promise.all([
      supabase.from('reading_sessions').select('id,creator_id,book_title,book_author,total_chapters,description,visibility,join_policy,status_type,cover_image_path,category_id,created_at').eq('id', sessionId).single(),
      supabase
        .from('session_members')
        .select('session_id,user_id,role')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('session_join_requests')
        .select('status')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([sessionResult, memberResult, requestResult]) => {
      if (sessionResult.data) setSession(sessionResult.data as ReadingSession)
      if (memberResult.data) setMembership(memberResult.data as SessionMembership)
      if (requestResult.data) setMyJoinRequestStatus((requestResult.data as { status: SessionJoinRequest['status'] }).status)
      setLoadingSession(false)
    })
  }, [sessionId, userId])

  useEffect(() => {
    if (!sessionId) return
    if (!canAccessSessionContent) {
      clearDetail()
      setActiveChapterMedia(null)
      setActiveChapterUrl(null)
      setActiveChapter(1)
      return
    }
    void loadDetail(sessionId)
    void loadMediaMeta()
  }, [sessionId, canAccessSessionContent, loadDetail, loadMediaMeta, clearDetail])

  useEffect(() => {
    if (!userId || !sessionId || !canAccessSessionContent) return

    const channel = supabase
      .channel(`session-detail-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        async (payload) => {
          const newComment = payload.new as Comment
          await ensureProfile(newComment.user_id)
          appendComment(newComment)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        () => { void loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `session_id=eq.${sessionId}` },
        () => { void loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progress_updates', filter: `session_id=eq.${sessionId}` },
        () => { void loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${sessionId}` },
        () => {
          void loadDetail(sessionId)
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
        () => { void loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_join_requests', filter: `session_id=eq.${sessionId}` },
        () => { void loadDetail(sessionId) },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_media', filter: `session_id=eq.${sessionId}` },
        () => { void loadMediaMeta() },
      )

    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, sessionId, canAccessSessionContent, loadDetail, ensureProfile, appendComment, loadMediaMeta])

  const memberLatestProgress = useMemo(() => buildLatestChapterByUser(detail.progress), [detail.progress])
  const commentMeta = useMemo(() => buildCommentMeta(detail.likes, userId), [detail.likes, userId])
  const pendingRequests = useMemo(
    () => detail.joinRequests.filter((r) => r.status === 'pending'),
    [detail.joinRequests],
  )

  const myLatestChapter = userId ? (memberLatestProgress[userId] ?? 0) : 0
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
    if (!sessionId || !canAccessSessionContent || sessionMedia.maxUploadedChapter < 1) return
    setActiveChapter(1)
    void loadChapterMedia(1)
  }, [sessionId, canAccessSessionContent, sessionMedia.maxUploadedChapter, loadChapterMedia])

  const handleSubmitComment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!userId || !sessionId || !commentDraft.trim()) return
      const result = await detail.submitComment(sessionId, userId, commentDraft)
      if (result !== false) {
        setCommentDraft('')
        notifyCreate({ type: 'COMMENT_CREATED', sessionId, actorId: userId })
      }
    },
    [userId, sessionId, commentDraft, detail],
  )

  const handleToggleLike = useCallback(
    async (commentId: string) => {
      if (!userId || !sessionId) return
      const liked = await detail.toggleLike(sessionId, userId, commentId)
      if (liked) {
        notifyCreate({
          type: 'COMMENT_LIKED',
          sessionId,
          actorId: userId,
          metadata: { commentId },
        })
      }
    },
    [userId, sessionId, detail],
  )

  const handleApproveJoinRequest = useCallback(
    async (request: SessionJoinRequest) => {
      if (!sessionId || !userId) return
      const approved = await detail.approveRequest(sessionId, request)
      if (approved) {
        notifyCreate({
          type: 'SESSION_JOINED',
          sessionId,
          actorId: request.user_id,
        })
      }
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

  // Unified save: visibility + join_policy in a single update
  const handleSaveSettings = useCallback(
    async (newVisibility: 'public' | 'private', newJoinPolicy: 'open' | 'request') => {
      if (!sessionId || !isOwner || !session) return
      const updates: { visibility?: 'public' | 'private'; join_policy?: 'open' | 'request' } = {}
      if (newVisibility !== session.visibility) updates.visibility = newVisibility
      if (newJoinPolicy !== session.join_policy) updates.join_policy = newJoinPolicy
      if (Object.keys(updates).length === 0) return

      setSavingSettings(true)
      setSettingsNotice(null)
      const { error } = await supabase.from('reading_sessions').update(updates).eq('id', sessionId)
      setSavingSettings(false)

      if (error) {
        setSettingsNotice(`Failed: ${error.message}`)
        return
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
              ...(updates.visibility ? { visibility: updates.visibility } : {}),
              ...(updates.join_policy ? { join_policy: updates.join_policy } : {}),
            }
          : prev,
      )
      setSettingsNotice(t.manage.settingsSaved)
      if (settingsNoticeTimeoutRef.current) clearTimeout(settingsNoticeTimeoutRef.current)
      settingsNoticeTimeoutRef.current = setTimeout(() => {
        settingsNoticeTimeoutRef.current = null
        setSettingsNotice(null)
      }, 2000)
    },
    [sessionId, isOwner, session, t.manage.settingsSaved],
  )

  const requestRemoveMember = useCallback(async (memberId: string) => {
    setRemoveMemberConfirmId(memberId)
  }, [])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!sessionId || !isOwner || memberId === userId) return
    setRemovingMemberId(memberId)
    await supabase.from('session_members').delete().eq('session_id', sessionId).eq('user_id', memberId)
    setRemovingMemberId(null)
    void detail.loadDetail(sessionId)
  }, [sessionId, isOwner, userId, detail])

  const handleDeleteSession = useCallback(async () => {
    if (!sessionId || !isOwner || !session) return
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

    // Best-effort: also remove cover image(s) so we don't leave orphan files
    // in the session-covers bucket after the session row is deleted.
    const coverCleanupError = await deleteSessionCover(
      session.creator_id,
      sessionId,
      session.cover_image_path ?? null,
    )
    if (coverCleanupError) {
      setDeleteError(`Cover cleanup failed: ${coverCleanupError}`)
      setDeletingSession(false)
      return
    }

    if (userId) {
      notifyCreate({ type: 'SESSION_DELETED', sessionId, actorId: userId })
    }

    const { error } = await supabase.from('reading_sessions').delete().eq('id', sessionId)
    setDeletingSession(false)
    if (!error) {
      onSessionDeleted?.(sessionId)
      navigate(-1)
      return
    }
    setDeleteError(error.message)
  }, [sessionId, isOwner, session, navigate, onSessionDeleted, userId])

  const handleJoinFromGate = useCallback(async () => {
    if (!session || !userId) return
    setJoiningSession(true)
    setJoinError(null)

    if (session.join_policy === 'request') {
      const { error } = await supabase
        .from('session_join_requests')
        .upsert(
          { session_id: session.id, user_id: userId, status: 'pending' },
          { onConflict: 'session_id,user_id' },
        )
      setJoiningSession(false)
      if (error) {
        setJoinError(error.message)
        return
      }
      setMyJoinRequestStatus('pending')
      setJoinModalOpen(false)
      notifyCreate({ type: 'JOIN_REQUESTED', sessionId: session.id, actorId: userId })
      return
    }

    const { error } = await supabase.from('session_members').insert({
      session_id: session.id,
      user_id: userId,
      role: 'member',
    })
    setJoiningSession(false)
    if (error) {
      setJoinError(error.message)
      return
    }
    setMembership({ session_id: session.id, user_id: userId, role: 'member' })
    setJoinModalOpen(false)
    notifyCreate({ type: 'SESSION_JOINED', sessionId: session.id, actorId: userId })
  }, [session, userId])

  // Per-chapter save progress.
  // RLS requires:  user_id = auth.uid()
  //                AND is_session_member(session_id, auth.uid())
  //                AND chapter_number <= max_uploaded_chapter(session_id)
  // We additionally enforce a STRICT SEQUENTIAL rule on the client:
  // only allow advancing by exactly one chapter (no skip-ahead, no backward overwrite).
  const handleSaveCurrentChapter = useCallback(async () => {
    setProgressError(null)
    if (!session || !membership || !sessionId) return
    if (isOwner) return // owners don't track reading progress

    const chapter = activeChapter
    if (chapter < 1 || chapter > session.total_chapters) return
    if (chapter > sessionMedia.maxUploadedChapter) return

    // STRICT SEQUENTIAL: allow current (no-op) or current + 1.
    // Insert only proceeds when advancing (chapter > myLatestChapter).
    if (chapter !== myLatestChapter && chapter !== myLatestChapter + 1) return
    if (chapter <= myLatestChapter) return

    // Defensive: use auth.uid() at insert time instead of the (possibly stale) prop.
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setProgressError(t.sessions.notMemberHint)
      return
    }
    const authUserId = authData.user.id

    setSavingChapterProgress(true)
    const { error } = await supabase.from('progress_updates').insert({
      session_id: session.id,
      user_id: authUserId,
      chapter_number: chapter,
    })
    setSavingChapterProgress(false)

    if (error) {
      setProgressError(error.message)
      return
    }
    void detail.loadDetail(sessionId)
  }, [
    session,
    membership,
    sessionId,
    isOwner,
    activeChapter,
    sessionMedia.maxUploadedChapter,
    myLatestChapter,
    detail,
    t.sessions.notMemberHint,
  ])

  if (loadingSession) {
    return (
      <section className="max-w-5xl mx-auto px-4 mt-4 w-full flex flex-col gap-4">
        <PageSpinner label={t.sessions.loadingSession} />
      </section>
    )
  }

  if (!session) {
    return (
      <section className="max-w-5xl mx-auto px-4 mt-4 w-full flex flex-col gap-4">
        <article className="card flex flex-col gap-4" style={{ textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
          <p className="eyebrow">404</p>
          <p className="subtle">{t.sessions.sessionNotFound}</p>
          <button
            type="button"
            className="secondary"
            style={{ alignSelf: 'center', display: 'flex', alignItems: 'center' }}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} style={{ marginRight: '0.25rem' }} /> {t.common.back}
          </button>
        </article>
      </section>
    )
  }

  // Gate: only members and the owner can view detail tabs.
  // Public sessions can be discovered (RLS allows the read), but UI redirects
  // non-members to a join-only view to keep parity with category page behavior.
  if (!isOwner && !isMember) {
    const isPendingRequest = myJoinRequestStatus === 'pending'
    return (
      <section className="max-w-5xl mx-auto px-4 mt-4 w-full flex flex-col gap-4">
        <div className="w-full">
          <div className="flex items-center justify-between gap-4 w-full">
            <button type="button" className="btn-back-compact" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={16} style={{ marginRight: '0.25rem' }} /> {t.common.back}
            </button>
          </div>
        </div>

        <article className="card flex flex-col gap-4" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>{session.book_title}</h2>
          <p className="subtle">{t.sessions.byAuthor(session.book_author)}</p>
          {session.description ? <p className="muted">{session.description}</p> : null}
          <p className="subtle">{t.sessions.notMemberHint}</p>

          {joinError ? <p className="error">{joinError}</p> : null}

          {isPendingRequest ? (
            <span className="pill">{t.sessions.requestPending}</span>
          ) : (
            <button
              type="button"
              className="primary"
              style={{ alignSelf: 'center' }}
              disabled={joiningSession}
              onClick={() => setJoinModalOpen(true)}
            >
              {session.join_policy === 'request' ? t.sessions.requestToJoin : t.sessions.joinSession}
            </button>
          )}
        </article>

        {joinModalOpen ? (
          <JoinSessionModal
            session={session}
            loading={joiningSession}
            onConfirm={() => { void handleJoinFromGate() }}
            onCancel={() => setJoinModalOpen(false)}
            titleLabel={t.sessions.joinModalTitle}
            descOpen={t.sessions.joinModalDescOpen}
            descRequest={t.sessions.joinModalDescRequest}
            confirmLabel={session.join_policy === 'request' ? t.sessions.requestToJoin : t.sessions.joinSession}
            cancelLabel={t.common.cancel}
          />
        ) : null}
      </section>
    )
  }

  const tabs: { key: SessionDetailTab; label: string }[] = [
    { key: 'media', label: t.sessions.tabMedia },
    { key: 'discussion', label: t.sessions.tabDiscussion },
    { key: 'manage', label: t.sessions.tabManage },
  ]

  return (
    <section className="max-w-5xl mx-auto px-4 mt-4 w-full flex flex-col gap-4">
      <div className="w-full mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <button type="button" className="btn-back-compact" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} style={{ marginRight: '0.25rem' }} /> {t.common.back}
          </button>
          <div className={`auth-switch detail-tab-switch ${canAnimate ? 'animated-pill-container' : ''}`} role="tablist" aria-label="Session tabs" ref={tabRef}>
            {canAnimate && <div className="animated-pill" style={{ ...tabPill, borderRadius: 'var(--radius-xs)' }} />}
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`auth-switch-option ${activeTab === tab.key ? 'auth-switch-option-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {progressError ? <p className="error">{progressError}</p> : null}

      <SessionDetailPanel
        t={t}
        activeTab={activeTab}
        selectedSession={session}
        selectedIsOwner={isOwner}
        selectedIsMember={isMember}
        loadingSessionDetail={detail.loading}
        sessionMembers={detail.members}
        sessionProfiles={detail.profiles}
        memberLatestProgress={memberLatestProgress}
        pendingRequests={pendingRequests}
        requestBusyId={null}
        onApproveJoinRequest={handleApproveJoinRequest}
        onRejectJoinRequest={handleRejectJoinRequest}
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
        myLatestChapter={myLatestChapter}
        savingChapterProgress={savingChapterProgress}
        onSaveCurrentChapter={handleSaveCurrentChapter}
        canUploadMedia={sessionMedia.canUpload}
        mediaUploading={sessionMedia.uploading}
        mediaError={sessionMedia.error}
        mediaLimit={sessionMedia.mediaLimit}
        nextChapter={sessionMedia.nextChapter}
        onUploadMedia={sessionMedia.uploadMedia}
        currentUserId={userId}
        savingSettings={savingSettings}
        settingsNotice={settingsNotice}
        onSaveSettings={isOwner ? handleSaveSettings : undefined}
        onRemoveMember={isOwner ? requestRemoveMember : undefined}
        removingMemberId={removingMemberId}
        onDeleteSession={isOwner ? () => setShowDeleteConfirm(true) : undefined}
        onLeaveSession={handleLeaveSession}
        leavingSession={leaving}
        leaveSessionDisabled={leaveSessionDisabled}
        commentDraft={commentDraft}
        postingComment={false}
        sessionComments={detail.comments}
        commentMeta={commentMeta}
        likingCommentId={null}
        onSubmitComment={handleSubmitComment}
        onCommentDraftChange={setCommentDraft}
        onToggleLike={handleToggleLike}
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

      {removeMemberConfirmId ? (
        <ConfirmModal
          message={t.manage.removeMemberConfirm}
          confirmLabel={removingMemberId ? t.common.working : t.manage.remove}
          cancelLabel={t.common.cancel}
          dangerous
          onConfirm={() => {
            const id = removeMemberConfirmId
            setRemoveMemberConfirmId(null)
            void handleRemoveMember(id)
          }}
          onCancel={() => setRemoveMemberConfirmId(null)}
        />
      ) : null}
    </section>
  )
}
