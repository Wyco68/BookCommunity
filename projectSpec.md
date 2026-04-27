# BookCom - Project Spec (Working Document)

## 1) Product Overview

- Name: BookCom
- Description: Anyone can register. A member can create a reading session for a book by submitting title, author, and chapters. Other members can join and submit chapter progress. Members discuss in a single thread per session and react to comments. The platform is evolving into a category-driven social application where users can create/join categories to group sessions, and session owners can upload restricted media (images/PDF/EPUB) representing chapters.
- Services: Supabase Backend
- Products: Web App, Mobile App

## 2) Follow-up Questions Asked

1. Should sessions be public-only in MVP, or do you need private/invite sessions now?
2. For progress, do you want chapter-only tracking, or chapter + percentage + notes?
3. Should session creators be allowed to moderate/delete others' comments in MVP?
4. Which reaction types do you want initially (Like only vs multiple)?
5. Do you want web and mobile MVP launched together, or web first then mobile?
6. Do you want OAuth (Google/Apple) in MVP, or email/password only?
7. Should guests be able to browse sessions without login, or authenticated-only app?
8. Any required localization/languages from day one?

## 3) Finalized Results from Follow-up

1. Session owner decides session behavior (including session visibility and join behavior).
2. Progress tracking is chapter-only and shown with a progress bar.
3. Session owner moderation of others' comments is not included yet.
4. Reactions are Like-only.
5. Web and mobile launch target is together.
6. Authentication is email/password now, OAuth later.
7. App is authenticated-only.
8. No localization requirement right now.

## 4) MVP Scope (Current Implementation Direction)

- Authentication: Sign up/sign in/sign out with email/password.
- Sessions:
	- Create session with title, author, total chapters, description, visibility, join policy.
- Session discovery:
	- Search by title/author.
	- Filter by visibility.
- Membership:
	- Open join sessions can be joined directly.
	- Request-to-join sessions use approval flow.
	- Members can leave sessions.
- Progress:
	- Submit current chapter.
	- Progress bar display.
- Discussion:
	- Single thread per session.
	- Members post comments.
	- Like-only reactions.
- Categories:
	- Browse, create, join, and leave categories.
	- Categories can be public or private.
	- Sessions can be grouped under categories.
- Media Sharing:
	- Session owners can upload media (images, PDFs, EPUBs) to a secure private bucket.
	- Media upload is rate-limited and capped by the total chapters in a session.
	- Media is accessed securely via temporary signed URLs.
- Realtime:
	- Live updates for comments, likes, progress, memberships, join requests, and categories.

## 5) Current Supabase Setup (for Future Context)

### 5.1 Supabase Project

- Supabase URL: https://rihvnpuuxuhlcdlwxkbf.supabase.co
- Publishable API key is configured locally in environment variables.

### 5.2 Schema and Policies Source of Truth

- Main schema file: supabase/schema.sql
- This file includes:
	- Tables
	- Triggers/functions
	- RLS enablement
	- RLS policies

### 5.3 Tables in Use

- profiles
- reading_sessions
- session_members
- progress_updates
- comments
- comment_likes
- session_join_requests
- categories
- category_members
- session_categories
- session_media

### 5.4 Functions and Triggers in Use

- public.handle_new_user() trigger function for creating profile rows from auth.users.
- Trigger on auth.users to run handle_new_user.
- public.create_reading_session(...) RPC to safely create sessions.
- public.is_session_member(...) helper to avoid RLS recursion in reading_sessions select policy.
- public.can_access_session(...) helper for secure media RLS policies.
- public.is_category_owner(...) and public.is_category_member(...) helpers for category RLS policies.

### 5.5 Storage Model

- Avatars and Media rely entirely on secure, private buckets.
- Strict 15-minute signed URLs are utilized for viewing any uploaded asset (public URLs are blocked for security).
- Client-side rate limiting and media dimension compression are enforced before upload.

### 5.6 Security Model Notes

- RLS enabled on all core app tables.
- Reading sessions read policy allows:
	- public visibility
	- session owner
	- confirmed member via helper function
- Join requests are owner-managed for approve/reject.
- Members and owners have distinct capabilities via policy checks.

## 6) Known Issues Encountered and Resolutions

1. SQL syntax errors around policy creation:
	 - Cause: unsupported create policy if not exists pattern.
	 - Fix: use drop policy if exists + create policy.

2. Infinite recursion in session_members or reading_sessions policies:
	 - Cause: circular policy references.
	 - Fix: introduce helper function public.is_session_member(...) with security definer and row_security off internally.

3. FK violation on reading_sessions.creator_id:
	 - Cause: missing profiles row for existing auth user.
	 - Fix: backfill profiles and ensure profile upsert path.

4. RLS insert failure on reading_sessions:
	 - Cause: inconsistent/legacy policies and insert path.
	 - Fix: deterministic policy reset and RPC-based creation function.

## 7) Current Status Summary

- Web app: MVP-level core features implemented, along with social expansion (Categories and secure Media galleries). Global React states are being refactored into dedicated custom hooks for better maintainability.
- Supabase: schema and RLS strategy updated to support categories, secure private media storage, search/filter, and request approvals.
- Mobile app: Expo + React Native client implemented with MVP parity for auth, sessions, membership, progress, discussion, likes, and join request approval flow. Needs updates to match the new web social features (Categories & Media).

## 8) Next Steps

1. Keep projectSpec.md updated whenever product decisions change.
2. When schema changes are made, update both:
	 - supabase/schema.sql
	 - this project spec (setup notes and known issues sections)
3. Add mobile EAS build/release pipeline and test on both Android and iOS devices.