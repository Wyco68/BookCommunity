# BookCom — Production Specification

Last updated: 2026-05-09

---

## 1) Product Overview

BookCom is an authenticated social reading app with:
- Session-based reading groups
- Chapter-based media progression
- Member discussion and reactions
- Category tagging for discovery

Backend is Supabase (Postgres + RLS + Storage).  
Web client is React/Vite. Mobile is Expo/RN (feature parity in progress).

---

## 2) Non-Negotiable Security Principles

- Server-side enforcement first: critical rules are in Postgres constraints/triggers/RLS.
- No trust in client input for authorization or chapter progression.
- Private storage only for protected media; access via signed URLs.
- Owner/member/public visibility checks are centralized through DB access rules.

---

## 3) Core Domain Model (Production)

## 3.1 Reading Sessions

`public.reading_sessions`

- `id uuid PK`
- `creator_id uuid FK -> profiles(id)`
- `book_title text not null`
- `book_author text not null`
- `total_chapters int not null check (total_chapters > 0)`
- `visibility text check in ('public','private')`
- `status_type enum('ongoing','completed')`
- `created_at timestamptz`

## 3.2 Membership

`public.session_members`

- `session_id uuid FK -> reading_sessions(id) on delete cascade`
- `user_id uuid FK -> profiles(id) on delete cascade`
- `role text check in ('owner','member')`
- `primary key (session_id, user_id)`

## 3.3 Categories

`public.categories`

- `id serial PK`
- `name text unique not null`

Seeded values:
- Action
- Adventure
- Romance
- Drama
- Comedy

`public.session_categories`

- `session_id uuid FK -> reading_sessions(id) on delete cascade`
- `category_id int FK -> categories(id) on delete cascade`
- `primary key (session_id, category_id)`

Constraint behavior:
- Deferred trigger enforces each session has at least one category.

## 3.4 Chapter Media

`public.session_media`

- `id uuid PK`
- `session_id uuid FK -> reading_sessions(id) on delete cascade`
- `uploader_id uuid FK -> profiles(id) on delete cascade`
- `chapter_number int not null check (chapter_number >= 1)`
- `file_path text not null`
- `created_at timestamptz default now()`
- `unique (session_id, chapter_number)` (one file per chapter)

Enforced progression:
- Owner-only uploads
- Strict sequential chapter upload (`next chapter = max_uploaded + 1`)

## 3.5 Progress

`public.progress_updates`

- `id uuid PK`
- `session_id uuid FK -> reading_sessions(id) on delete cascade`
- `user_id uuid FK -> profiles(id) on delete cascade`
- `chapter_number int not null check (chapter_number >= 1)`
- `created_at timestamptz default now()`

Progress rule:
- `chapter_number <= max_uploaded_chapter(session_id)`

---

## 4) Required DB Functions and Triggers

## 4.1 Functions

- `public.is_session_member(session_id, user_id)`  
  Membership helper used in access logic.

- `public.can_access_session(session_id, user_id)`  
  Access helper: public session OR creator OR member.

- `public.max_uploaded_chapter(session_id)`  
  Returns current max uploaded chapter for session.

## 4.2 Triggers

- `trg_enforce_sequential_session_media` (before insert on `session_media`)  
  Enforces sequential uploads and chapter <= `total_chapters`.

- `trg_enforce_progress_uploaded_limit` (before insert on `progress_updates`)  
  Blocks progress above uploaded limit.

- `trg_enforce_session_has_category_iud` (constraint trigger on `session_categories`)  
  Keeps minimum one category per session.

---

## 5) RLS Policy Contract (Production)

All listed tables have RLS enabled.

## 5.1 `reading_sessions`

- `SELECT`: authenticated users if public, creator, or session member
- `INSERT`: creator must equal `auth.uid()`
- `DELETE`: creator only

## 5.2 `session_media`

- `SELECT`: `can_access_session(session_id, auth.uid())`
- `INSERT`: uploader must be `auth.uid()` and must be session creator
- Sequential chapter enforcement is in trigger + unique constraint

## 5.3 `progress_updates`

- `SELECT`: `can_access_session(session_id, auth.uid())`
- `INSERT`: `user_id = auth.uid()`, user must be session member, chapter <= max uploaded

## 5.4 `session_categories`

- `SELECT`: all authenticated
- `INSERT`/`DELETE`: session owner only

## 5.5 `categories`

- `SELECT`: authenticated users
- `INSERT`/`UPDATE`/`DELETE`: denied (read-only system data)

---

## 6) Storage (Production)

## 6.1 Chapter Files

Bucket: `session-media` (private)

- Stores chapter media files only
- Access controlled by session visibility/membership/ownership via storage RLS

## 6.2 Session Covers

Bucket: `session-covers` (private)

- Stores session cover images only
- Path format: `{user_id}/{session_id}/cover.{ext}`
- Upload/update/delete by session owner only
- Read allowed via `can_access_session(...)`

---

## 7) Query Behavior Contract

## 7.1 Session Card

Must display:
- Category names (join: `session_categories -> categories`)
- Cover image (prefer `reading_sessions.cover_image_path`, fallback to first chapter image)
- Status-aware chapters:
  - `ongoing` -> numeric total chapters
  - `completed` -> "Completed"
- Progress strip:
  - owner: `Uploaded: X chapters`
  - member: `Your Progress`

## 7.2 Category Page

Selected category sessions query must enforce:
- `reading_sessions.visibility = 'public'`
- selected `category_id`

Recommended join shape:
- `session_categories` joined with `reading_sessions`

---

## 8) Session Detail UI Contract

- Owner cannot submit progress updates.
- Owner can upload next chapter only.
- Chapter navigation uses Prev/Next and loads one chapter at a time.
- Viewer behavior:
  - image: inline image
  - pdf: embedded iframe viewer
  - epub: fallback open/download
- No preloading all chapters.

---

## 9) Confirmation UX Requirements

UI must require user confirmation for:
- uploading a new chapter
- deleting a session

These are UI safeguards and do not replace DB authorization.

---

## 10) Operational Notes

- Core session/category/media/progress tables are intentionally strict to prevent drift.
- If schema changes are needed, update both:
  - `supabase/schema.sql`
  - this document
- Keep all auth and progression rules enforceable at DB level.

---

## 11) Known Boundaries

- Categories are system-managed only (no user-created categories).
- One chapter file per chapter per session.
- Non-sequential chapter uploads are invalid by design.
- Client behavior should not assume write access where RLS denies it.
# BookCom — Project Specification (Living Document)

---

## 1. Product Overview

- **Name:** BookCom
- **Description:** An authenticated social reading platform. Members create reading sessions for books and invite or allow others to join. Each session has a single discussion thread, per-member chapter progress, and optional restricted media attachments. Sessions can be grouped into categories. The app targets dual-client delivery: web (React/Vite) and mobile (Expo/React Native), both backed by Supabase.
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **Clients:** Web App, Mobile App

---

## 2. Finalized Product Decisions

| # | Decision |
|---|----------|
| 1 | Session visibility and join policy are set by the creator. |
| 2 | Progress tracking is chapter-number only (integer). |
| 3 | Comment moderation by session owner is not in MVP. |
| 4 | Reactions are Like-only (one like per user per comment). |
| 5 | Web and mobile launch together. |
| 6 | Authentication is email/password only (OAuth planned post-MVP). |
| 7 | App is authenticated-only (no guest browsing). |
| 8 | No localization requirement in MVP (UI strings are in English and Burmese). |

---

## 3. MVP Feature Scope

- **Auth:** Sign up / Sign in / Sign out with email + password.
- **Sessions:** Create, discover (search/filter), join (open or request), leave, view detail.
- **Progress:** Submit current chapter; progress bar derived from latest entry.
- **Discussion:** Single thread per session; members post comments and like comments.
- **Join Requests:** Request-to-join sessions require owner approval/rejection.
- **Categories:** System-seeded groups for sessions; users cannot join/create categories; session owner tags sessions.
- **Media:** Session owner uploads images or book files (PDF/EPUB) up to `total_chapters` slots; accessed via 15-minute signed URLs only.
- **Realtime:** Supabase Realtime channels for comments, likes, progress, members, join requests.

---

## 4. Database Schema

### 4.1 SQL Schema (drop + recreate for affected objects)

```sql
-- Extensions
create extension if not exists pgcrypto;

-- 1) Session status enum
drop type if exists public.session_status_type cascade;
create type public.session_status_type as enum ('ongoing', 'completed');

-- 2) Drop category system and session-media/progress objects that changed
drop table if exists public.category_members cascade;
drop table if exists public.session_categories cascade;
drop table if exists public.categories cascade;
drop table if exists public.progress_updates cascade;
drop table if exists public.session_media cascade;

-- 3) reading_sessions: add status_type and keep existing relationships
alter table public.reading_sessions
  add column if not exists status_type public.session_status_type not null default 'ongoing';

-- 4) Simplified categories (system-owned, read-only)
create table public.categories (
  id integer generated always as identity primary key,
  name text not null unique
);

insert into public.categories (name)
values
  ('Action'),
  ('Adventure'),
  ('Romance'),
  ('Drama'),
  ('Comedy')
on conflict (name) do nothing;

-- 5) Session-category mapping (at least 1 category per session)
create table public.session_categories (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  category_id integer not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (session_id, category_id)
);

-- 6) Session media with chapter binding + DB validation
create table public.session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number integer not null check (chapter_number >= 1),
  media_type text not null check (media_type in ('image', 'book_file')),
  file_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  mime_type text not null check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/epub+zip'
    )
  ),
  description text,
  created_at timestamptz not null default now()
);

-- 7) Progress updates with chapter constraints
create table public.progress_updates (
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number integer not null check (chapter_number >= 1),
  created_at timestamptz not null default now()
);

-- 8) Helper: max uploaded chapter per session
create or replace function public.max_uploaded_chapter(p_session_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(max(sm.chapter_number), 0)
  from public.session_media sm
  where sm.session_id = p_session_id
$$;

-- 9) Trigger: enforce media and chapter rules for session_media
create or replace function public.enforce_session_media_rules()
returns trigger
language plpgsql
as $$
declare
  v_total integer;
  v_status public.session_status_type;
  v_count integer;
begin
  select rs.total_chapters, rs.status_type
    into v_total, v_status
  from public.reading_sessions rs
  where rs.id = new.session_id;

  if v_total is null then
    raise exception 'Session not found';
  end if;

  if new.chapter_number > v_total then
    raise exception 'chapter_number exceeds total_chapters';
  end if;

  select count(*) into v_count
  from public.session_media sm
  where sm.session_id = new.session_id
    and (tg_op <> 'UPDATE' or sm.id <> new.id);

  if v_count + 1 > v_total then
    raise exception 'media count cannot exceed total_chapters';
  end if;

  if v_status = 'completed' and new.chapter_number > v_total then
    raise exception 'completed sessions cannot accept media beyond total_chapters';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_session_media_rules on public.session_media;
create trigger trg_enforce_session_media_rules
before insert or update on public.session_media
for each row
execute function public.enforce_session_media_rules();

-- 10) Trigger: progress must stay within uploaded chapter and total_chapters
create or replace function public.enforce_progress_rules()
returns trigger
language plpgsql
as $$
declare
  v_total integer;
  v_max_uploaded integer;
begin
  select rs.total_chapters
    into v_total
  from public.reading_sessions rs
  where rs.id = new.session_id;

  if v_total is null then
    raise exception 'Session not found';
  end if;

  if new.chapter_number > v_total then
    raise exception 'chapter_number exceeds total_chapters';
  end if;

  v_max_uploaded := public.max_uploaded_chapter(new.session_id);
  if new.chapter_number > v_max_uploaded then
    raise exception 'chapter_number exceeds max uploaded chapter';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_progress_rules on public.progress_updates;
create trigger trg_enforce_progress_rules
before insert on public.progress_updates
for each row
execute function public.enforce_progress_rules();

-- 11) Trigger: owner must have at least one media (deferred, transaction-safe)
create or replace function public.enforce_session_has_media()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.session_media sm
    where sm.session_id = new.id
  ) then
    raise exception 'Session must have at least one media upload';
  end if;
  return new;
end;
$$;
-- Note: not attached to reading_sessions; session creation and media upload are separate operations.

-- 12) Trigger: every session must keep >= 1 category
create or replace function public.enforce_session_has_category()
returns trigger
language plpgsql
as $$
declare
  v_session_id uuid;
begin
  if tg_table_name = 'reading_sessions' then
    v_session_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  end if;

  if not exists (
    select 1
    from public.session_categories sc
    where sc.session_id = v_session_id
  ) then
    raise exception 'Each session must have at least one category';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enforce_session_has_category_iud on public.session_categories;
create constraint trigger trg_enforce_session_has_category_iud
after insert or update or delete on public.session_categories
deferrable initially deferred
for each row
execute function public.enforce_session_has_category();

-- Note: not attached to reading_sessions; category linking is a separate operation.

-- 13) Helpful indexes for required query behavior
create index if not exists idx_session_categories_category_id
  on public.session_categories(category_id);
create index if not exists idx_reading_sessions_visibility
  on public.reading_sessions(visibility);
create index if not exists idx_session_media_session_id
  on public.session_media(session_id, created_at desc, id desc);
create index if not exists idx_progress_updates_session_id
  on public.progress_updates(session_id, created_at desc);
```

---

### 4.3 Storage Bucket

| Bucket ID | Public | Purpose |
|-----------|--------|---------|
| `session-media` | `false` | Stores session file uploads (images, PDFs, EPUBs) |

Avatars and cover images also use a private bucket (path stored in `profiles.avatar_url` / `categories.cover_image_path`).  
All reads are via Supabase `createSignedUrl()` with a 15-minute expiry.

---

### 4.4 Relationships Summary

```
auth.users ────────────── profiles                (1:1)
profiles   ────────────── reading_sessions        (1:N  creator)
profiles   ──────────────────────────────────────────────────
                          session_members         (M:N  profile ↔ session)
                          progress_updates        (1:N  per user per session)
                          comments                (1:N  per user per session)
                          comment_likes           (M:N  profile ↔ comment)
                          session_join_requests   (1:N  per user per session)
                          session_media           (1:N  uploader)
reading_sessions ──────── comments                (1:N)
reading_sessions ──────── session_members         (1:N)
reading_sessions ──────── progress_updates        (1:N)
reading_sessions ──────── session_join_requests   (1:N)
reading_sessions ──────── session_media           (1:N)
reading_sessions ──────────────────────────────────
                          session_categories      (M:N  session ↔ category)
categories ────────────── session_categories      (1:N  category ↔ session links)
comments   ────────────── comment_likes           (1:N)
```

---

## 5. Access Control Rules (RLS)

All tables have `ROW LEVEL SECURITY` enabled. Access is denied by default.

### 5.1 RLS SQL (updated policies)

```sql
alter table public.reading_sessions enable row level security;
alter table public.progress_updates enable row level security;
alter table public.session_media enable row level security;
alter table public.categories enable row level security;
alter table public.session_categories enable row level security;

-- reading_sessions (same core behavior)
drop policy if exists reading_sessions_select on public.reading_sessions;
create policy reading_sessions_select
on public.reading_sessions
for select
to authenticated
using (
  visibility = 'public'
  or creator_id = auth.uid()
  or public.is_session_member(id, auth.uid())
);

drop policy if exists reading_sessions_insert on public.reading_sessions;
create policy reading_sessions_insert
on public.reading_sessions
for insert
to authenticated
with check (false); -- direct INSERT denied; use create_reading_session RPC

drop policy if exists reading_sessions_update on public.reading_sessions;
create policy reading_sessions_update
on public.reading_sessions
for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists reading_sessions_delete on public.reading_sessions;
create policy reading_sessions_delete
on public.reading_sessions
for delete
to authenticated
using (creator_id = auth.uid());

-- progress_updates
drop policy if exists progress_updates_select on public.progress_updates;
create policy progress_updates_select
on public.progress_updates
for select
to authenticated
using (public.is_session_member(session_id, auth.uid()));

drop policy if exists progress_updates_insert on public.progress_updates;
create policy progress_updates_insert
on public.progress_updates
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_session_member(session_id, auth.uid())
  and chapter_number <= public.max_uploaded_chapter(session_id)
);

-- session_media
drop policy if exists session_media_select on public.session_media;
create policy session_media_select
on public.session_media
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_media_insert on public.session_media;
create policy session_media_insert
on public.session_media
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_media.session_id
      and rs.creator_id = auth.uid()
      and session_media.chapter_number <= rs.total_chapters
  )
);

drop policy if exists session_media_delete on public.session_media;
create policy session_media_delete
on public.session_media
for delete
to authenticated
using (
  uploader_id = auth.uid()
  or exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_media.session_id
      and rs.creator_id = auth.uid()
  )
);

-- categories (read-only system data)
drop policy if exists categories_select on public.categories;
create policy categories_select
on public.categories
for select
to authenticated
using (true);

drop policy if exists categories_insert on public.categories;
create policy categories_insert
on public.categories
for insert
to authenticated
with check (false);

drop policy if exists categories_update on public.categories;
create policy categories_update
on public.categories
for update
to authenticated
using (false)
with check (false);

drop policy if exists categories_delete on public.categories;
create policy categories_delete
on public.categories
for delete
to authenticated
using (false);

-- session_categories (owner-managed links)
drop policy if exists session_categories_select on public.session_categories;
create policy session_categories_select
on public.session_categories
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_categories_insert on public.session_categories;
create policy session_categories_insert
on public.session_categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_categories.session_id
      and rs.creator_id = auth.uid()
  )
);

drop policy if exists session_categories_delete on public.session_categories;
create policy session_categories_delete
on public.session_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_categories.session_id
      and rs.creator_id = auth.uid()
  )
);
```

### 5.2 Rule Notes (1-2 lines each)

- `status_type` enforces explicit session lifecycle (`ongoing`, `completed`) at the type level.
- `progress_updates` is blocked unless the chapter is already uploaded media (`max_uploaded_chapter`) and user is a session member.
- `session_media.chapter_number` is required and validated (`>= 1` and `<= total_chapters`) via CHECK + trigger.
- Session media uploads are owner-only and capped by `total_chapters` using RLS and trigger safeguards.
- `session_categories` deferred trigger rejects transactions that leave a session without categories.
- Session creation UI requires at least one media; DB still enforces media chapter/count constraints.
- `categories` is system-owned, seeded data: authenticated users can read, but cannot insert/update/delete.
- MIME types are constrained to approved image/book formats; file size is constrained server-side (max 50 MB).
- Category page query remains `visibility = 'public' AND category_id = selected`; pagination/lazy loading is query-level.

---

## 6. API Actions (CRUD)

### Authentication
| Action | Method | Notes |
|--------|--------|-------|
| Sign up | Supabase `signUp({ email, password })` | Triggers `handle_new_user()` |
| Sign in | Supabase `signInWithPassword({ email, password })` | — |
| Sign out | Supabase `signOut()` | — |
| Re-auth (password change) | `signInWithPassword` then `updateUser({ password })` | Old password required |

### Profiles
| Action | Table Op | Notes |
|--------|----------|-------|
| Load profile | SELECT by `id` | — |
| Update display name | UPDATE `profiles` | — |
| Upload avatar | Storage upload → UPDATE `profiles.avatar_url` | File path stored, not public URL |

### Reading Sessions
| Action | Table Op | Notes |
|--------|----------|-------|
| Create | RPC `create_reading_session(...)` | Returns new row; creator added as `owner` member |
| List all active | SELECT `reading_sessions` WHERE `status = 'active'` | RLS filters private sessions |
| Search by title/author | SELECT with `ilike` filter | — |
| Filter by visibility | SELECT with `visibility` filter | — |
| Get single | SELECT by `id` | — |
| Update | UPDATE by `id` | Owner only |
| Archive | UPDATE `status = 'archived'` | Owner only |
| Delete | DELETE by `id` | Owner only; cascades to all children |

### Session Membership
| Action | Table Op | Notes |
|--------|----------|-------|
| Join (open) | INSERT `session_members` | `join_policy = 'open'` |
| Request to join | UPSERT `session_join_requests` | `join_policy = 'request'`; status = `pending` |
| Approve request | UPDATE `session_join_requests.status = 'approved'` + INSERT `session_members` | Owner only |
| Reject request | UPDATE `session_join_requests.status = 'rejected'` | Owner only |
| Leave | DELETE from `session_members` | Blocked if owner + only session |
| Load members | SELECT `session_members` WHERE `session_id` | — |

### Progress Updates
| Action | Table Op | Notes |
|--------|----------|-------|
| Submit progress | INSERT `progress_updates` | Append-only |
| Load progress for session | SELECT `progress_updates` WHERE `session_id` | Latest per user by `created_at DESC` |
| Read chapters by users | Aggregation: sum of latest chapter per distinct user | Computed in app |

### Comments
| Action | Table Op | Notes |
|--------|----------|-------|
| Post comment | INSERT `comments` | Rate-limited: 10/60 s, cooldown 3 s |
| Load comments | SELECT `comments` WHERE `session_id` ORDER BY `created_at ASC` | — |
| Soft-delete own | UPDATE `is_deleted = true` | Owner of comment |

### Comment Likes
| Action | Table Op | Notes |
|--------|----------|-------|
| Like | INSERT `comment_likes` | Deduped by UNIQUE constraint |
| Unlike | DELETE `comment_likes` WHERE `id` | Toggle; only own |
| Load likes for session | SELECT `comment_likes` WHERE `comment_id IN (session_comments)` | — |

### Categories
| Action | Table Op | Notes |
|--------|----------|-------|
| Create | Not allowed | Categories are seeded system data only |
| List | SELECT `categories` | RLS: all authenticated users can read |
| Link session | INSERT `session_categories` | Session owner only |
| Unlink session | DELETE `session_categories` | Session owner only |
| Load sessions in category | SELECT `session_categories` + JOIN `reading_sessions` | `reading_sessions.visibility = 'public'` and selected category |

### Media
| Action | Table Op | Notes |
|--------|----------|-------|
| Upload | Storage PUT to `session-media` bucket + INSERT `session_media` | Owner only; requires `chapter_number`; server-enforced count/chapter constraints |
| List | SELECT `session_media` WHERE `session_id` | Paginated by cursor (`created_at`, `id`) |
| View (signed URL) | `createSignedUrl(file_path, 900)` | 15-minute expiry; generated on demand |
| Delete | Storage DELETE + DELETE `session_media` | Uploader or session owner |

---

## 7. Indexes

| Index | Table | Columns |
|-------|-------|---------|
| `idx_session_categories_session` | `session_categories` | `session_id` |
| `idx_session_categories_category` | `session_categories` | `category_id` |
| `idx_session_media_session` | `session_media` | `session_id` |
| `idx_session_media_session_cursor` | `session_media` | `(session_id, created_at DESC, id DESC)` |
| `idx_session_media_uploader` | `session_media` | `uploader_id` |
| `idx_comments_session` | `comments` | `session_id` |
| `idx_comment_likes_comment` | `comment_likes` | `comment_id` |
| `idx_progress_updates_session` | `progress_updates` | `session_id` |
| `idx_progress_updates_session_created` | `progress_updates` | `(session_id, created_at DESC)` |
| `idx_session_members_session` | `session_members` | `session_id` |
| `idx_session_members_user` | `session_members` | `user_id` |
| `idx_session_join_requests_session` | `session_join_requests` | `session_id` |

---

## 8. Database Functions & Triggers

| Name | Type | Behaviour |
|------|------|-----------|
| `handle_new_user()` | Trigger function | Fires AFTER INSERT on `auth.users`; creates matching row in `profiles` |
| `create_reading_session(...)` | RPC | Inserts into `reading_sessions`; inserts creator as `owner` in `session_members` |
| `is_session_member(uuid, uuid)` | Security-definer function | Used in RLS to avoid recursive policy evaluation |
| `can_access_session(uuid, uuid)` | Security-definer function | Checks public visibility, direct membership, or category membership |
| `max_uploaded_chapter(uuid)` | SQL function | Returns max uploaded media chapter for strict progress validation |
| `enforce_session_media_rules()` | Trigger function | Enforces chapter bounds and media-count ≤ `total_chapters` |
| `enforce_progress_rules()` | Trigger function | Blocks progress above uploaded chapter / total chapters |
| `enforce_session_has_media()` | Deferred constraint trigger | Rejects session create/update transaction with zero media |
| `enforce_session_has_category()` | Deferred constraint trigger | Rejects transaction where session has no category |

All security-definer functions run `set_config('row_security', 'off', true)` internally to avoid circular policy evaluation.

---

## 9. Client-Side Rate Limits

| Action | Max | Window | Cooldown |
|--------|-----|--------|----------|
| Post comment | 10 | 60 s | 3 s |
| Upload media | 5 | 60 s | 5 s |
| Create session | 3 | 60 s | — |
| Submit join request | 10 | 60 s | — |

Limits are tracked in-memory per client session (`rateLimit.ts`). Server-side enforcement via Supabase Edge Functions is planned post-MVP.

---

## 10. Edge Cases & Constraints

| Case | Handling |
|------|----------|
| User leaves only owned session | Blocked in app UI; RLS does not prevent it — owner must transfer or delete |
| Duplicate join request | UPSERT with `ON CONFLICT (session_id, user_id)` keeps one row; status reset to `pending` |
| Duplicate like | UNIQUE constraint on `(comment_id, user_id)`; INSERT is idempotent via toggle logic |
| Media upload over chapter cap | RLS INSERT policy counts existing rows < `total_chapters`; INSERT rejected server-side |
| Approve already-member | `session_members` INSERT on conflict is silently ignored (`duplicate` error swallowed) |
| FK violation on session creation | Profile upsert is performed before session creation RPC |
| RLS recursion on session SELECT | `is_session_member()` with `row_security off` breaks the cycle |
| Signed URL exposure | File paths stored as opaque storage keys; signed URLs generated per-request, expire in 15 min |
| Soft-deleted comment | `is_deleted = true`; body replaced with `[deleted]` in UI; row retained for like counts |
| Category mutability | Categories are read-only system data; users cannot create/edit/delete categories |
| Session without category | Deferred DB trigger rejects commit if no `session_categories` row exists |
| Session without media | Deferred DB trigger rejects commit if no `session_media` row exists |
| Session archived | Still visible to members; `status = 'active'` filter excludes it from main discovery list |
| Progress above uploaded chapter | DB trigger + RLS reject `chapter_number > max_uploaded_chapter(session_id)` |
| Progress below 1 or above total | DB checks/triggers reject out-of-range values server-side |
| Avatar/cover stored as path | Signed URL resolved at render time; prevents stale permanent URLs |

---



---
---

## 13. Current Status

| Client | Status |
|--------|--------|
| Web (React/Vite) | MVP complete + categories + secure media gallery |
| Mobile (Expo/RN) | MVP parity (auth, sessions, progress, discussion, likes, join requests); categories and media pending |

---

## 14. Next Steps

1. Keep `projectSpec.md` updated with every schema or product change.
2. Update `supabase/schema.sql` whenever a migration is applied.
3. Add server-side rate limiting via Supabase Edge Functions.
4. Transfer session ownership action (currently no UI path).
5. OAuth (Google/Apple) post-MVP auth expansion.
