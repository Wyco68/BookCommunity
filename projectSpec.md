# Books & Friends - Project Spec (Working Document)

## 1) Product Overview

- Name: Books & Friends
- Description: Anyone can register. A member can create a reading session for a book by submitting title, author, and chapters. Other members can join and submit chapter progress. Members discuss in a single thread per session and react to comments.
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
	- Active and archived session states.
	- Owner can archive and restore own sessions.
- Session discovery:
	- Search by title/author.
	- Filter by visibility.
	- Active/archived tab views.
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
- Realtime:
	- Live updates for comments, likes, progress, memberships, and join requests.

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

### 5.4 Functions and Triggers in Use

- public.handle_new_user() trigger function for creating profile rows from auth.users.
- Trigger on auth.users to run handle_new_user.
- public.create_reading_session(...) RPC to safely create sessions.
- public.is_session_member(...) helper to avoid RLS recursion in reading_sessions select policy.

### 5.5 Security Model Notes

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

- Web app: MVP-level core features implemented.
- Supabase: schema and RLS strategy updated to support search/filter, archive/restore, and request approvals.
- Mobile app: still pending implementation.

## 8) Next Steps

1. Keep projectSpec.md updated whenever product decisions change.
2. When schema changes are made, update both:
	 - supabase/schema.sql
	 - this project spec (setup notes and known issues sections)
3. Add mobile implementation plan once web parity is stable.