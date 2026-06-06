# BookCom — Project Specification

Last updated: 2026-05-15

**Schema source of truth:** `supabase/schema.sql` (drop + create: tables, enums, functions, triggers, indexes, RLS, storage policies).

---

## 1. Product overview

BookCom is an authenticated social reading web app. Users create **reading sessions** for books, invite or allow others to join, upload chapter media (owner only), track per-member chapter progress, and discuss in a single thread per session.

- **Client:** React + Vite + TypeScript
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, RLS)
- **Auth:** Email/password and Google OAuth (web); redirect URL must include `/auth/callback`

---

## 2. Security principles (non-negotiable)

- Critical rules live in Postgres: constraints, triggers, RLS, and `security definer` helpers.
- Never trust the client for authorization or chapter progression.
- Protected media uses **private** buckets; clients use short-lived signed URLs only.
- Session access is centralized in `public.can_discover_session` (listing) and `public.can_view_session_content` (member content).

---

## 3. Domain model

### 3.1 `public.profiles`

| Column | Notes |
|--------|--------|
| `id` | PK, FK → `auth.users(id)` |
| `username` | Required, unique (case-insensitive), 3–32 chars, `[a-z0-9_-]`, no spaces; auto-generated on signup; sole public display name |
| `username_updated_at` | Set when username changes; 30-day cooldown between changes |
| `avatar_url` | Storage path `{user_id}/avatar.{jpg\|jpeg\|png\|webp}` or remote `https://` URL (OAuth); enforced by `enforce_profiles_avatar_url` trigger |
| `created_at`, `updated_at` | Timestamps |

Created on signup via `handle_new_user()` trigger on `auth.users` (allocates unique username from email prefix). Clients cannot `INSERT` or `DELETE` profiles (`REVOKE INSERT`, no delete policy); only `SELECT`/`UPDATE` own row. Usernames are unique case-insensitively (`profiles_username_lower_unique`).

### 3.2 `public.categories`

System-seeded, read-only lookup table.

| Column | Notes |
|--------|--------|
| `id` | Identity PK |
| `name` | Unique |

**Seeded names:** Action, Adventure, Romance, Drama, Comedy, Study.

### 3.3 `public.reading_sessions`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `creator_id` | FK → `profiles` |
| `book_title`, `book_author` | Required, trimmed, max 200 chars |
| `description` | Optional, max 2000 chars |
| `total_chapters` | `> 0`, max 10000 |
| `visibility` | `public` \| `private` |
| `join_policy` | `open` \| `request` |
| `status_type` | `ongoing` \| `completed` |
| `cover_image_path` | Optional path in `session-covers` bucket |
| **`category_id`** | **Required FK → `categories(id)` — exactly one category per session** |
| `created_at` | Timestamp |

**Session creation:** direct `INSERT` is denied by RLS. Use RPC `create_reading_session(..., p_category_id integer, ...)`, which inserts the session and adds the creator as `owner` in `session_members`.

There is **no** `session_categories` or `category_members` table. Category assignment is set at creation (and stored on the session row).

### 3.4 `public.session_members`

| Column | Notes |
|--------|--------|
| `session_id`, `user_id` | Composite PK |
| `role` | `owner` \| `member` |
| `joined_at` | Timestamp |

### 3.5 `public.session_media`

One file per chapter per session (`unique (session_id, chapter_number)`).

| Column | Notes |
|--------|--------|
| `media_type` | `image` \| `book_file` |
| `file_path` | Must start with `{session_id}/`; no `..` segments |
| `mime_type` | JPEG, PNG, WebP, PDF, EPUB |
| `file_size_bytes` | 1 … 52,428,800 (50 MB) |

**Upload rules:** owner only; sequential chapters (`next = max_uploaded + 1`); `chapter_number <= total_chapters`.

### 3.6 `public.progress_updates`

Append-only member progress. `chapter_number <= max_uploaded_chapter(session_id)` and `<= total_chapters`. **Owners do not record progress** (enforced in UI; members only in RLS insert path).

### 3.7 `public.comments`, `public.comment_likes`, `public.session_join_requests`

Standard social/join flows; see `schema.sql` RLS section.

---

## 4. Functions and triggers

| Name | Role |
|------|------|
| `handle_new_user()` | After insert on `auth.users` → create `profiles` row |
| `is_session_member(session_id, user_id)` | RLS helper; `security definer`, RLS off inside |
| `can_discover_session(session_id, user_id)` | Public session OR creator OR member (listing/covers) |
| `can_view_session_content(session_id, user_id)` | Creator OR member (chapter media, comments, member list) |
| `can_access_session(session_id, user_id)` | Alias of `can_discover_session` |
| `max_uploaded_chapter(session_id)` | Max `session_media.chapter_number` for session |
| `create_reading_session(...)` | Validated session create + owner membership |
| `enforce_sequential_session_media()` | Before insert on `session_media` |
| `enforce_progress_uploaded_limit()` | Before insert on `progress_updates` |
| `enforce_session_media_file_path()` | Before insert/update on `session_media` |
| `enforce_session_media_mime_consistency()` | Validates mime_type ↔ media_type ↔ file extension |
| `enforce_rate_limit(...)` | Server-side rate limiting for inserts and RPCs |
| `enforce_comments_immutable_session()` | `comments.session_id` immutable on update |
| `enforce_reading_sessions_total_chapters_floor()` | Cannot lower `total_chapters` below uploaded/progress max |
| `enforce_profiles_username()` | Required/format username; 30-day change cooldown |
| `enforce_profiles_avatar_url()` | Storage avatar paths must belong to `profiles.id` |
| `allocate_username(base, exclude_id?)` | Race-safe unique username allocation (signup/backfill) |
| Edge Function `delete-account` | Storage cleanup + `auth.admin.deleteUser` (sole account-delete path) |

---

## 5. RLS contract (summary)

All application tables have RLS enabled. Deny-by-default except where policies allow.

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `profiles` | All authenticated | **Denied** | Own row | **Denied** |
| `reading_sessions` | Public OR creator OR member | **Denied** (use RPC) | Creator | Creator |
| `session_members` | `can_view_session_content` | Owner adds OR self-join if `join_policy = open` | — | Self or owner |
| `session_media` | `can_view_session_content` | Creator only | — | Uploader or creator |
| `progress_updates` | Members | Member, own row, chapter ≤ max uploaded | — | — |
| `comments` | `can_view_session_content` | Members | Own row | Own row |
| `comment_likes` | Via comment access | Members | — | Own row |
| `session_join_requests` | Self or session creator | Self, `request` policy | Creator | Self |
| `categories` | All authenticated | **Denied** | **Denied** | **Denied** |

Storage buckets: `session-media`, `session-covers`, `profile-avatars` (private). Chapter media uses `can_view_session_content`; session covers use `can_discover_session`. See `schema.sql` for full policy SQL.

---

## 6. Storage

| Bucket | Purpose | Path pattern |
|--------|---------|----------------|
| `session-media` | Chapter files | `{session_id}/{user_id}/{uuid}.{ext}` |
| `session-covers` | Cover images | `{user_id}/{session_id}/cover.{ext}` |
| `profile-avatars` | Avatars | `{user_id}/avatar.{ext}` |

Signed URL expiry (client): 5 minutes.

**Account deletion:** The Edge Function `delete-account` removes the user's objects from `profile-avatars`, `session-media` (uploads and media on sessions they created), and `session-covers` (paths on created sessions + `{user_id}/` folder), then deletes the auth user. Postgres `ON DELETE CASCADE` removes `profiles`, sessions they created, memberships, comments, likes, progress, and media rows. Clients must not delete DB rows or storage manually for account removal.

**Avatar upload:** Client uploads to `{user_id}/avatar.{ext}` only; after a successful profile update, stale files under `{user_id}/` are removed (handles extension changes).

---

## 7. Query and UI contracts

### Session cards

- Category label: join `categories` on `reading_sessions.category_id` (single name).
- Cover: `cover_image_path` or fallback to first chapter image.
- Owner: show upload progress, not “My Progress”.
- Members: show latest chapter from `progress_updates`.

### Category page

```sql
SELECT … FROM reading_sessions
WHERE category_id = :selected
  AND visibility = 'public'
ORDER BY created_at DESC;
```

No join through a link table.

### Session detail

- Tabs: Media, Discussion, Manage.
- Owner: upload next chapter only; no progress submit.
- Members: sequential progress save; see all members’ progress except owner row in lists.
- Non-members on public sessions: join gate only (no detail tabs until member).

### Confirmations (UI only)

- Upload chapter
- Delete session
- Remove member

---

## 8. Client API patterns

| Action | Mechanism |
|--------|-----------|
| Create session | `rpc('create_reading_session', { …, p_category_id })` |
| List/search sessions | `select` on `reading_sessions` (RLS-filtered) |
| Join (open) | `insert` `session_members` |
| Request join | `upsert` `session_join_requests` |
| Approve/reject | Owner `update` request + `insert` member |
| Progress | `insert` `progress_updates` |
| Media | Storage upload + `insert` `session_media` |
| Realtime | Channels on comments, likes, progress, members, join requests, media |
| Delete account | `functions.invoke('delete-account')` then sign out |

---

## 9. Indexes (production)

Defined in `schema.sql`, including:

- `idx_reading_sessions_category_visibility` — category browse
- `idx_reading_sessions_status_created` — home list
- `idx_session_members_user_session` — membership checks
- `idx_session_media_session_cursor` — media pagination
- `idx_progress_updates_session_created` — progress timeline

---

## 10. Edge cases

| Case | Handling |
|------|----------|
| Invalid `category_id` on create | RPC raises `Invalid category` |
| Skip-ahead media chapter | Trigger rejects non-sequential insert |
| Progress above uploaded | Trigger + RLS reject |
| Owner sole member leaving | UI blocks; owner should delete session |
| RLS recursion | `is_session_member` / `can_access_session` use `row_security off` |
| Category mutability | System data only; no client writes |

---

## 11. Operational notes

1. After schema changes, update **`supabase/schema.sql`** and this document.
2. Existing DBs that still have `session_categories`: run `supabase/migrations/one_category_per_session.sql` once, then align with `schema.sql` on greenfield installs.
3. Policies: always `drop policy if exists` then `create policy` (no `create policy if not exists` on Postgres).
4. Profile FK on session create: RPC upserts `profiles` for `auth.uid()` before insert.

---

## 12. Known boundaries

- One category per session (`category_id` NOT NULL).
- One media file per chapter.
- Categories cannot be created or edited by users.
- Authenticated-only product (no guest browsing).
- Client rate limits (`rateLimit.ts`) provide UX feedback; server enforces via `enforce_rate_limit` triggers and `create_reading_session` RPC.
