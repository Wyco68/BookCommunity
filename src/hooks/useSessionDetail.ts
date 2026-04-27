import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Comment, CommentLike, Profile, ProgressUpdate, SessionJoinRequest, SessionMembership } from '../types'
import { resolveAvatarUrlMap, isRemoteUrl } from '../lib/avatar'

export interface UseSessionDetailReturn {
  comments: Comment[]
  likes: CommentLike[]
  members: SessionMembership[]
  progress: ProgressUpdate[]
  profiles: Record<string, Profile>
  joinRequests: SessionJoinRequest[]
  loading: boolean
  error: string | null
  loadDetail: (sessionId: string) => Promise<void>
  submitComment: (sessionId: string, userId: string, body: string) => Promise<void>
  toggleLike: (sessionId: string, userId: string, commentId: string) => Promise<void>
  approveRequest: (sessionId: string, request: SessionJoinRequest) => Promise<void>
  rejectRequest: (sessionId: string, request: SessionJoinRequest) => Promise<void>
  clearDetail: () => void
}

export function useSessionDetail(): UseSessionDetailReturn {
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<CommentLike[]>([])
  const [members, setMembers] = useState<SessionMembership[]>([])
  const [progress, setProgress] = useState<ProgressUpdate[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [joinRequests, setJoinRequests] = useState<SessionJoinRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async (sessionId: string) => {
    setLoading(true)

    const [commentsResult, membersResult, progressResult, requestsResult] = await Promise.all([
      supabase.from('comments').select('id,session_id,user_id,body,is_deleted,created_at').eq('session_id', sessionId).order('created_at'),
      supabase.from('session_members').select('session_id,user_id,role').eq('session_id', sessionId),
      supabase
        .from('progress_updates')
        .select('session_id,user_id,chapter_number,created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('session_join_requests')
        .select('id,session_id,user_id,status,created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
    ])

    if (commentsResult.error || membersResult.error || progressResult.error || requestsResult.error) {
      setError(
        commentsResult.error?.message ||
          membersResult.error?.message ||
          progressResult.error?.message ||
          requestsResult.error?.message ||
          'Failed to load session details',
      )
      setLoading(false)
      return
    }

    const commentsData = (commentsResult.data ?? []) as Comment[]
    const membersData = (membersResult.data ?? []) as SessionMembership[]
    const progressData = (progressResult.data ?? []) as ProgressUpdate[]
    const requestsData = (requestsResult.data ?? []) as SessionJoinRequest[]

    let likesData: CommentLike[] = []
    if (commentsData.length > 0) {
      const commentIds = commentsData.map((comment) => comment.id)
      const likesResult = await supabase
        .from('comment_likes')
        .select('id,comment_id,user_id,created_at')
        .in('comment_id', commentIds)

      if (likesResult.error) {
        setError(likesResult.error.message)
        setLoading(false)
        return
      }

      likesData = (likesResult.data ?? []) as CommentLike[]
    }

    const profileUserIds = Array.from(
      new Set([
        ...membersData.map((member) => member.user_id),
        ...commentsData.map((comment) => comment.user_id),
        ...requestsData.map((request) => request.user_id),
      ]),
    )

    let profileLookup: Record<string, Profile> = {}
    if (profileUserIds.length > 0) {
      const profilesResult = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', profileUserIds)

      if (profilesResult.error) {
        setError(profilesResult.error.message)
        setLoading(false)
        return
      }

      const profilesArr = (profilesResult.data ?? []) as Profile[]
      const resolvedAvatars = await resolveAvatarUrlMap(
        profilesArr.map((profile) => profile.avatar_url).filter((avatarUrl): avatarUrl is string => Boolean(avatarUrl)),
      )

      for (const profile of profilesArr) {
        profileLookup[profile.id] = profile
        if (profile.avatar_url && !isRemoteUrl(profile.avatar_url) && resolvedAvatars[profile.avatar_url]) {
          profileLookup[profile.id] = { ...profile, avatar_url: resolvedAvatars[profile.avatar_url] }
        }
      }
    }

    setComments(commentsData)
    setMembers(membersData)
    setProgress(progressData)
    setLikes(likesData)
    setJoinRequests(requestsData)
    setProfiles(profileLookup)
    setLoading(false)
  }, [])

  const submitComment = useCallback(async (_sessionId: string, userId: string, body: string) => {
    if (!body.trim()) return

    const { error } = await supabase.from('comments').insert({
      session_id: _sessionId,
      user_id: userId,
      body: body.trim(),
    })

    if (error) {
      setError(error.message)
    }
  }, [])

  const toggleLike = useCallback(async (_sessionId: string, userId: string, commentId: string) => {
    const existingLike = likes.find((like) => like.comment_id === commentId && like.user_id === userId)

    if (existingLike) {
      const { error } = await supabase.from('comment_likes').delete().eq('id', existingLike.id)
      if (error) {
        setError(error.message)
      }
    } else {
      const { error } = await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: userId,
      })

      if (error) {
        setError(error.message)
      }
    }
  }, [likes])

  const approveRequest = useCallback(async (sessionId: string, request: SessionJoinRequest) => {
    const updateResult = await supabase
      .from('session_join_requests')
      .update({ status: 'approved' })
      .eq('id', request.id)

    if (updateResult.error) {
      setError(updateResult.error.message)
      return
    }

    const membershipResult = await supabase.from('session_members').insert({
      session_id: sessionId,
      user_id: request.user_id,
      role: 'member',
    })

    if (membershipResult.error && !membershipResult.error.message.toLowerCase().includes('duplicate')) {
      setError(membershipResult.error.message)
    }
  }, [])

  const rejectRequest = useCallback(async (_sessionId: string, request: SessionJoinRequest) => {
    const { error } = await supabase
      .from('session_join_requests')
      .update({ status: 'rejected' })
      .eq('id', request.id)

    if (error) {
      setError(error.message)
    }
  }, [])

  const clearDetail = useCallback(() => {
    setComments([])
    setLikes([])
    setMembers([])
    setProgress([])
    setProfiles({})
    setJoinRequests([])
    setError(null)
  }, [])

  return {
    comments,
    likes,
    members,
    progress,
    profiles,
    joinRequests,
    loading,
    error,
    loadDetail,
    submitComment,
    toggleLike,
    approveRequest,
    rejectRequest,
    clearDetail,
  }
}