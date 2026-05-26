export type SessionVisibility = 'public' | 'private'
export type SessionStatus = 'active' | 'archived'
export type SessionStatusType = 'ongoing' | 'completed'

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
  status_type: SessionStatusType
  cover_image_path: string | null
  category_id: number
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
  username: string
  username_updated_at: string | null
  avatar_url: string | null
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  body: string
  reply_to_id: string | null
  is_deleted: boolean
  created_at: string
}

export interface PostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
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


export type MediaType = 'image' | 'book_file'

export interface Category {
  id: number
  name: string
  description?: string | null
}

export interface SessionMedia {
  id: string
  session_id: string
  uploader_id: string
  chapter_number: number
  media_type: MediaType
  file_path: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  description: string | null
  created_at: string
}

export interface SessionCardMediaPreview {
  session_id: string
  file_path: string
  file_name: string
  mime_type: string
  media_type: MediaType
  is_image: boolean
  signed_url: string | null
}

export interface PaginationCursor {
  created_at: string
  id: string
}

export interface PaginatedResult<T> {
  data: T[]
  nextCursor: PaginationCursor | null
  hasMore: boolean
}

export type NotificationEventType =
  | 'SESSION_JOINED'
  | 'SESSION_DELETED'
  | 'CHAPTER_UPDATED'
  | 'COMMENT_CREATED'
  | 'COMMENT_LIKED'
  | 'JOIN_REQUESTED'

export interface NotificationMetadata {
  sessionTitle?: string
  actorUsername?: string
  commentId?: string
  chapterId?: string
  [key: string]: unknown
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationEventType
  session_id: string | null
  actor_id: string | null
  metadata: NotificationMetadata
  is_read: boolean
  idempotency_key: string | null
  created_at: string
}

export interface UserNotificationPreferences {
  user_id: string
  email_enabled: boolean
  email_session_joined: boolean
  email_chapter_updated: boolean
  email_session_deleted: boolean
  email_comment_created: boolean
  email_comment_liked: boolean
  email_join_requested: boolean
  updated_at: string
}
