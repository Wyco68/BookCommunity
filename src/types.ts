export type SessionVisibility = 'public' | 'private'
export type SessionStatus = 'active' | 'archived'

export interface ReadingSession {
  id: string
  creator_id: string
  book_title: string
  book_author: string
  total_chapters: number
  description: string | null
  visibility: SessionVisibility
  join_policy: 'open' | 'request'
  status: SessionStatus
  created_at: string
}

export interface SessionMembership {
  session_id: string
  user_id: string
  role: 'member' | 'owner'
}

export interface ProgressUpdate {
  session_id: string
  user_id: string
  chapter_number: number
  created_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export interface Comment {
  id: string
  session_id: string
  user_id: string
  body: string
  is_deleted: boolean
  created_at: string
}

export interface CommentLike {
  id: string
  comment_id: string
  user_id: string
  created_at: string
}

export interface SessionJoinRequest {
  id: string
  session_id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
