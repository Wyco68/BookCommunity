# 1. Overview
- **Purpose**: A platform to facilitate collaborative reading experiences where users join reading sessions, consume uploaded media chapter by chapter, track progress, and interact via comments.
- **Target users**: Readers, book clubs, educators, and content creators looking to share reading material in a structured format.
- **System scope**: A responsive web application and a native mobile app sharing a unified backend for authentication, database, real-time messaging, and storage.

# 2. Architecture
- **Frontend structure**: The web app uses React with Vite, utilizing Zustand for global state and custom hooks for Supabase integrations. The mobile app uses React Native via Expo. Both clients share the same data model concepts.
- **Backend**: Supabase provides PostgreSQL, Auth, Realtime APIs, and Object Storage.
- **Data flow**: Clients interface directly with Supabase via `@supabase/supabase-js`. Complex security and validation rules are pushed to the database tier using Row Level Security (RLS) policies and triggers.

# 3. Features (DETAILED)

## User Profiles & Authentication
- **Description**: Users sign up via email/password or Google OAuth. An automated username allocation system creates unique handles based on email addresses.
- **User flow**: User logs in -> Automatic profile creation if missing -> Dashboard access.
- **Edge cases**: Username collisions are mitigated with a robust allocation sequence suffix.
- **Constraints enforced**: Usernames must be 3-32 characters, lowercase alphanumeric. Avatar paths strictly follow `{user_id}/avatar.{ext}`.

## Reading Sessions
- **Description**: Core container for reading a specific book. Has a title, author, fixed total chapters, and a category.
- **User flow**: User creates session -> Selects Public/Private -> Selects Open/Request join policy -> Acts as 'owner'.
- **Edge cases**: Total chapters cannot be arbitrarily reduced after progress or media are uploaded.
- **Constraints enforced**: Total chapters must be > 0 and cannot be reduced below the maximum uploaded chapter or any member's current progress.

## Session Membership & Access Control
- **Description**: Users must be members to participate in private sessions or upload progress.
- **User flow**: 
  - *Open*: User clicks join -> Added instantly as 'member'.
  - *Request*: User clicks join -> Request pending -> Owner approves -> Added as 'member'.
- **Edge cases**: Joining a private session where the owner deletes the session during the pending request.
- **Constraints enforced**: RLS blocks non-members from viewing private sessions, session media, comments, and progress updates.

## Media Uploads
- **Description**: Owners upload content (images or EPUB/PDF) chapter by chapter.
- **User flow**: Owner accesses session -> Uploads Chapter 1 -> Uploads Chapter 2.
- **Edge cases**: Re-uploading a chapter is blocked unless properly handled (DB requires unique (session_id, chapter_number)).
- **Constraints enforced**: Enforced strictly by DB triggers `enforce_sequential_session_media`. Chapter numbers must be sequential (no skipping) and cannot exceed the session's `total_chapters`.

## Progress Tracking
- **Description**: Members log which chapter they have read.
- **User flow**: Member reads a chapter -> Marks as read -> Progress increments.
- **Edge cases**: Trying to read ahead of what the owner uploaded.
- **Constraints enforced**: DB triggers ensure a user cannot mark progress beyond the highest *uploaded* chapter by the owner.

## Comments
- **Description**: Users can comment on sessions and like comments.
- **User flow**: Member views session -> Leaves a comment -> Others can like it.
- **Edge cases**: Commenting on a session right after being removed. RLS drops the INSERT cleanly.
- **Constraints enforced**: Comments are bound to a session permanently. Users can only delete/update their own comments.

# 4. Authentication & Authorization
- **Auth methods**: Supabase Auth (Email/Password, Google OAuth).
- **Session handling**: Handled via Supabase session cookies/tokens and React context (`useAuth`).
- **RLS explanation**: RLS acts as the primary authorization mechanism. Policies check if `auth.uid()` matches row owners, or use `SECURITY DEFINER` helper functions (`is_session_member`, `can_access_session`) to validate relationships without triggering infinite recursion.

# 5. Database Design
- **Tables**: `profiles`, `categories`, `reading_sessions`, `session_members`, `comments`, `comment_likes`, `session_join_requests`, `session_media`, `progress_updates`, `user_notification_preferences`, `notifications`.
- **Relationships**: `reading_sessions` belongs to a `creator_id` (profile) and `category_id`. Everything else is heavily linked to `session_id` and `user_id`.
- **Constraints**: Constraints guarantee data bounds, like `total_chapters > 0` and file sizes <= 50MB.
- **Triggers**: 
  - `handle_new_user`: Allocates usernames on auth signup.
  - `enforce_sequential_session_media`: Validates upload order.
  - `enforce_progress_uploaded_limit`: Restricts user progress.
- **Important functions**: `allocate_username()`, `can_access_session()`, `is_session_member()`, `max_uploaded_chapter()`.

# 6. Realtime System
- **What updates in realtime**: The `notifications` table.
- **How it's implemented**: Supabase Realtime channel `postgres_changes` listens for `INSERT` and `UPDATE` on the `notifications` table filtered by `user_id=eq.${userId}`. State is mapped into the frontend via `useNotificationRealtime` and Zustand store.

# 7. Security Model
- **RLS policies**: Comprehensive policies for SELECT, INSERT, UPDATE, DELETE on every public table and storage bucket.
- **Validation layers**: Client-side validation exists for UX (e.g. `src/lib/validation.ts`), but the Database (CHECK constraints, Trigger functions, RLS) is the strict source of truth for business logic.
- **Attack surface analysis**: Direct database modifications by malicious clients are mitigated by RLS. Direct file URL access is prevented because buckets are private and rely on signed URLs scoped by RLS.

# 8. Performance Considerations
- **Query design**: Compound indexes heavily optimize common queries (e.g., `idx_reading_sessions_status_created`, `idx_session_media_session_cursor`). Helper functions handling complex RLS bypass recursion issues by using `SECURITY DEFINER` and turning off row security internally (`set_config('row_security', 'off', true)`).
- **Client-side optimization**: Pagination is implemented via cursors (`created_at`, `id` tuples) for feed loading, avoiding offset limitations.

# 9. Known Limitations
- Vitest operates in a strict Node environment, so any testing involving DOM interactions is currently unsupported.
- Progress updates are monotonic; members cannot "unread" a chapter once marked read.
- Media uploads must be strictly sequential; an owner cannot upload chapter 3 before chapter 2.

# 10. Future Improvements (REALISTIC ONLY)
- Allow editing or un-doing progress updates.
- Allow owners to replace or patch media for already uploaded chapters.
- Expand end-to-end testing coverage using Playwright for browser interactions.
