-- BookCom — full recreate schema (single source of truth)
-- One reading session = one category via reading_sessions.category_id (FK).
-- Run in Supabase SQL Editor on a new project, or after backup on an existing DB.

create extension if not exists pgcrypto;

-- ── Legacy category model (removed) ─────────────────────────────────────────
drop trigger if exists trg_enforce_session_has_category_iud on public.session_categories;
drop table if exists public.session_categories cascade;
drop table if exists public.category_members cascade;
drop function if exists public.enforce_session_has_category() cascade;
drop function if exists public.is_category_member(integer, uuid) cascade;
drop function if exists public.is_category_owner(integer, uuid) cascade;

-- Old RPC signatures (multi-category / array overloads)
drop function if exists public.create_reading_session(text, text, int, text, text, integer[]) cascade;
drop function if exists public.create_reading_session(text, text, text, text, int, text) cascade;
drop function if exists public.create_reading_session(text, text, integer[], text, text, int, text) cascade;

-- ── Enums ───────────────────────────────────────────────────────────────────
drop type if exists public.session_status_type cascade;
create type public.session_status_type as enum ('ongoing', 'completed');

-- ── Username helpers (before profiles table CHECK) ────────────────────────────
create or replace function public.is_valid_username(p_username text)
returns boolean
language sql
immutable
strict
as $$
  select p_username is not null
    and char_length(p_username) >= 3
    and char_length(p_username) <= 32
    and p_username = lower(p_username)
    and position(' ' in p_username) = 0
    and p_username ~ '^[a-z0-9][a-z0-9_-]{2,}$';
$$;

create or replace function public.username_base_from_email(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_local text;
  v_base text;
begin
  v_local := split_part(coalesce(p_email, ''), '@', 1);
  v_base := lower(regexp_replace(v_local, '[^a-z0-9]', '', 'g'));
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'user';
  end if;
  if char_length(v_base) > 28 then
    v_base := left(v_base, 28);
  end if;
  return v_base;
end;
$$;

-- ── Tables (dependency order) ───────────────────────────────────────────────
drop table if exists public.comment_likes cascade;
drop table if exists public.comments cascade;
drop table if exists public.progress_updates cascade;
drop table if exists public.session_join_requests cascade;
drop table if exists public.session_media cascade;
drop table if exists public.session_members cascade;
drop table if exists public.reading_sessions cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_updated_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format_check check (public.is_valid_username(username))
);

create unique index profiles_username_lower_unique on public.profiles (lower(username));

create or replace function public.allocate_username(
  p_base text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int;
begin
  perform set_config('row_security', 'off', true);

  v_base := lower(regexp_replace(coalesce(p_base, ''), '[^a-z0-9]', '', 'g'));
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'user';
  end if;
  if char_length(v_base) > 28 then
    v_base := left(v_base, 28);
  end if;

  perform pg_advisory_xact_lock(hashtext('username_alloc:' || v_base));

  for v_suffix in 0..9999 loop
    if v_suffix = 0 then
      v_candidate := v_base;
    else
      v_candidate := v_base || v_suffix::text;
    end if;

    if char_length(v_candidate) > 32 then
      continue;
    end if;

    if not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(v_candidate)
        and (p_exclude_id is null or p.id <> p_exclude_id)
    ) then
      return v_candidate;
    end if;
  end loop;

  raise exception 'Could not allocate unique username for base %', v_base;
end;
$$;

create table public.categories (
  id integer generated always as identity primary key,
  name text not null unique
);

create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  book_title text not null check (char_length(book_title) <= 200 and length(trim(book_title)) > 0),
  book_author text not null check (char_length(book_author) <= 200 and length(trim(book_author)) > 0),
  description text check (description is null or char_length(description) <= 2000),
  total_chapters int not null check (total_chapters > 0),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  join_policy text not null default 'open' check (join_policy in ('open', 'request')),
  status_type public.session_status_type not null default 'ongoing',
  cover_image_path text,
  category_id integer not null references public.categories(id),
  created_at timestamptz not null default now()
);

create table public.session_members (
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 5000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table public.session_join_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table public.session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number int not null check (chapter_number >= 1),
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
  description text check (description is null or char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  unique (session_id, chapter_number)
);

create table public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number int not null check (chapter_number >= 1),
  created_at timestamptz not null default now()
);

insert into public.categories (name)
values ('Action'), ('Adventure'), ('Romance'), ('Drama'), ('Comedy'), ('Study')
on conflict (name) do nothing;

create or replace function public.enforce_profiles_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cooldown interval := interval '30 days';
begin
  if new.username is null or btrim(new.username) = '' then
    raise exception 'username is required';
  end if;

  new.username := lower(btrim(new.username));

  if not public.is_valid_username(new.username) then
    raise exception 'invalid username: at least 3 characters, lowercase letters, numbers, underscore or hyphen only, no spaces';
  end if;

  if tg_op = 'UPDATE' then
    if old.username is distinct from new.username then
      if old.username_updated_at is not null
         and old.username_updated_at + v_cooldown > now() then
        raise exception 'username can only be changed once every 30 days';
      end if;
      new.username_updated_at := now();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_username text;
  v_attempt int := 0;
begin
  perform set_config('row_security', 'off', true);

  if exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  v_base := public.username_base_from_email(new.email);

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'Could not create profile with unique username for user %', new.id;
    end if;

    v_username := public.allocate_username(v_base);

    begin
      insert into public.profiles (id, username)
      values (new.id, v_username);
      exit;
    exception
      when unique_violation then
        continue;
    end;
  end loop;

  return new;
end;
$$;

create or replace function public.enforce_profiles_avatar_url()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar_url is null then
    return new;
  end if;

  if new.avatar_url ~* '^https?://' then
    return new;
  end if;

  if new.avatar_url !~ ('^' || new.id::text || '/avatar\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid avatar path: must be {user_id}/avatar.{jpg|jpeg|png|webp}';
  end if;

  return new;
end;
$$;

create or replace function public.is_session_member(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.session_members sm
    where sm.session_id = p_session_id
      and sm.user_id = p_user_id
  );
end;
$$;

create or replace function public.can_access_session(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);
  return exists (
    select 1
    from public.reading_sessions rs
    where rs.id = p_session_id
      and (
        rs.visibility = 'public'
        or rs.creator_id = p_user_id
        or public.is_session_member(p_session_id, p_user_id)
      )
  );
end;
$$;

-- SECURITY DEFINER so RLS check expressions and triggers that call this can
-- read session_media without hitting the caller's RLS policy on that table.
-- (Avoids: "query would be affected by row-level security policy for table session_media".)
create or replace function public.max_uploaded_chapter(p_session_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_max integer;
begin
  perform set_config('row_security', 'off', true);
  select coalesce(max(sm.chapter_number), 0) into v_max
  from public.session_media sm
  where sm.session_id = p_session_id;
  return v_max;
end;
$$;

create or replace function public.create_reading_session(
  p_book_title     text,
  p_book_author    text,
  p_total_chapters int,
  p_visibility     text,
  p_join_policy    text,
  p_category_id    integer,
  p_description    text default null
)
returns public.reading_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_session public.reading_sessions;
  v_title text;
  v_author text;
  v_desc text;
begin
  perform set_config('row_security', 'off', true);

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_title := trim(p_book_title);
  v_author := trim(p_book_author);
  v_desc := nullif(trim(coalesce(p_description, '')), '');

  if v_title = '' then
    raise exception 'book_title is required';
  end if;

  if v_author = '' then
    raise exception 'book_author is required';
  end if;

  if char_length(v_title) > 200 or char_length(v_author) > 200 then
    raise exception 'book_title and book_author must be 200 characters or fewer';
  end if;

  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'description must be 2000 characters or fewer';
  end if;

  if p_total_chapters <= 0 then
    raise exception 'total_chapters must be greater than 0';
  end if;

  if p_total_chapters > 10000 then
    raise exception 'total_chapters must be 10000 or fewer';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;

  if p_join_policy not in ('open', 'request') then
    raise exception 'Invalid join_policy';
  end if;

  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Invalid category';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile not found for authenticated user';
  end if;

  insert into public.reading_sessions (
    creator_id, book_title, book_author, description,
    total_chapters, visibility, join_policy, category_id
  )
  values (
    v_user_id,
    v_title,
    v_author,
    v_desc,
    p_total_chapters,
    p_visibility,
    p_join_policy,
    p_category_id
  )
  returning * into v_session;

  insert into public.session_members (session_id, user_id, role)
  values (v_session.id, v_user_id, 'owner')
  on conflict (session_id, user_id) do nothing;

  return v_session;
end;
$$;

-- Trigger functions run as table owner (SECURITY DEFINER) so the RLS on
-- session_media / reading_sessions cannot block our validation reads.
create or replace function public.enforce_sequential_session_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_max int;
begin
  perform set_config('row_security', 'off', true);

  select rs.total_chapters into v_total
  from public.reading_sessions rs
  where rs.id = new.session_id;

  if v_total is null then
    raise exception 'Session not found';
  end if;

  if new.chapter_number > v_total then
    raise exception 'chapter_number exceeds total_chapters';
  end if;

  v_max := public.max_uploaded_chapter(new.session_id);
  if new.chapter_number <> v_max + 1 then
    raise exception 'chapter_number must be sequential (next chapter only)';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_progress_uploaded_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_max_uploaded int;
begin
  perform set_config('row_security', 'off', true);

  select rs.total_chapters into v_total
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
    raise exception 'chapter_number exceeds uploaded chapter limit';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists trg_enforce_profiles_username on public.profiles;
create trigger trg_enforce_profiles_username
before insert or update of username on public.profiles
for each row
execute function public.enforce_profiles_username();

drop trigger if exists trg_enforce_profiles_avatar_url on public.profiles;
create trigger trg_enforce_profiles_avatar_url
before insert or update of avatar_url on public.profiles
for each row
execute function public.enforce_profiles_avatar_url();

drop trigger if exists trg_enforce_sequential_session_media on public.session_media;
create trigger trg_enforce_sequential_session_media
before insert on public.session_media
for each row
execute function public.enforce_sequential_session_media();

drop trigger if exists trg_enforce_progress_uploaded_limit on public.progress_updates;
create trigger trg_enforce_progress_uploaded_limit
before insert on public.progress_updates
for each row
execute function public.enforce_progress_uploaded_limit();

create or replace function public.enforce_session_media_file_path()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);

  if new.file_path is null or new.file_path !~ '^[0-9a-fA-F-]{36}/' then
    raise exception 'file_path must start with a UUID session prefix';
  end if;

  if position(new.session_id::text || '/' in new.file_path) <> 1 then
    raise exception 'file_path must start with session_id prefix';
  end if;

  if new.file_path ~ '\.\.' then
    raise exception 'file_path must not contain parent-directory segments';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_session_media_file_path on public.session_media;
create trigger trg_enforce_session_media_file_path
before insert or update on public.session_media
for each row
execute function public.enforce_session_media_file_path();

create or replace function public.enforce_comments_immutable_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.session_id is distinct from new.session_id then
    raise exception 'comments.session_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comments_immutable_session on public.comments;
create trigger trg_comments_immutable_session
before update on public.comments
for each row
execute function public.enforce_comments_immutable_session();

create or replace function public.enforce_reading_sessions_total_chapters_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_uploaded int;
  v_max_progress int;
begin
  perform set_config('row_security', 'off', true);

  if new.total_chapters is distinct from old.total_chapters then
    v_max_uploaded := public.max_uploaded_chapter(new.id);

    select coalesce(max(pu.chapter_number), 0) into v_max_progress
    from public.progress_updates pu
    where pu.session_id = new.id;

    if new.total_chapters < v_max_uploaded then
      raise exception 'total_chapters cannot be less than uploaded chapters (%)', v_max_uploaded;
    end if;

    if new.total_chapters < v_max_progress then
      raise exception 'total_chapters cannot be less than a member''s recorded progress (%)', v_max_progress;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reading_sessions_total_chapters_floor on public.reading_sessions;
create trigger trg_reading_sessions_total_chapters_floor
before update on public.reading_sessions
for each row
execute function public.enforce_reading_sessions_total_chapters_floor();

-- Backfill profiles for auth users without a row (same allocator as handle_new_user)
do $$
declare
  r record;
  v_username text;
  v_attempt int;
begin
  for r in
    select u.id, u.email
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 50 then
        raise exception 'Could not backfill profile for user %', r.id;
      end if;
      v_username := public.allocate_username(public.username_base_from_email(r.email));
      begin
        insert into public.profiles (id, username)
        values (r.id, v_username);
        exit;
      exception
        when unique_violation then
          continue;
      end;
    end loop;
  end loop;
end;
$$;

revoke all on function public.create_reading_session(text, text, int, text, text, integer, text) from public;
grant execute on function public.create_reading_session(text, text, int, text, text, integer, text) to authenticated;

revoke all on function public.is_session_member(uuid, uuid) from public;
grant execute on function public.is_session_member(uuid, uuid) to authenticated;

revoke all on function public.can_access_session(uuid, uuid) from public;
grant execute on function public.can_access_session(uuid, uuid) to authenticated;

revoke all on function public.max_uploaded_chapter(uuid) from public;
grant execute on function public.max_uploaded_chapter(uuid) to authenticated;

revoke all on function public.is_valid_username(text) from public;
grant execute on function public.is_valid_username(text) to authenticated;

revoke all on function public.username_base_from_email(text) from public;
grant execute on function public.username_base_from_email(text) to authenticated;

revoke all on function public.allocate_username(text, uuid) from public;
grant execute on function public.allocate_username(text, uuid) to authenticated;

-- reading_sessions: individual filter columns
create index if not exists idx_reading_sessions_visibility
  on public.reading_sessions(visibility);
create index if not exists idx_reading_sessions_creator_id
  on public.reading_sessions(creator_id);
-- composite: category page query (category_id = X AND visibility = 'public')
create index if not exists idx_reading_sessions_category_visibility
  on public.reading_sessions(category_id, visibility);
-- composite: main sessions list (status_type = 'ongoing' ORDER BY created_at DESC)
create index if not exists idx_reading_sessions_status_created
  on public.reading_sessions(status_type, created_at desc);

-- session_members: composite (user_id, session_id) for is_session_member() RLS helper
-- also covers user_id-only lookups (leading column); PK(session_id,user_id) covers session_id lookups
create index if not exists idx_session_members_user_session
  on public.session_members(user_id, session_id);

-- session_media: composite covers all session_id + cursor-pagination queries
create index if not exists idx_session_media_session_cursor
  on public.session_media(session_id, created_at desc, id desc);
create index if not exists idx_session_media_uploader
  on public.session_media(uploader_id);

-- comments: composite covers session_id filter + created_at ordering
create index if not exists idx_comments_session_created
  on public.comments(session_id, created_at);
create index if not exists idx_comment_likes_comment
  on public.comment_likes(comment_id);

-- progress_updates: composite covers session_id filter + created_at ordering
create index if not exists idx_progress_updates_session_created
  on public.progress_updates(session_id, created_at desc);

-- session_join_requests: both axes of frequent lookups
create index if not exists idx_session_join_requests_session
  on public.session_join_requests(session_id);
create index if not exists idx_session_join_requests_user
  on public.session_join_requests(user_id);

alter table public.profiles enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.progress_updates enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.session_join_requests enable row level security;
alter table public.categories enable row level security;
alter table public.session_media enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert on public.profiles;

revoke insert on public.profiles from authenticated;
revoke insert on public.profiles from anon;

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
on public.profiles
for delete
to authenticated
using (false);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

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
with check (false);

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

drop policy if exists session_members_select on public.session_members;
create policy session_members_select
on public.session_members
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

drop policy if exists session_members_insert on public.session_members;
create policy session_members_insert
on public.session_members
for insert
to authenticated
with check (
  -- Path 1: Session owner adds any member (e.g. approve join request)
  exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_members.session_id
      and rs.creator_id = auth.uid()
  )
  -- Path 2: Self-join, but ONLY for open-join sessions
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.reading_sessions rs
      where rs.id = session_members.session_id
        and rs.join_policy = 'open'
    )
  )
);

drop policy if exists session_members_delete on public.session_members;
create policy session_members_delete
on public.session_members
for delete
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_members.session_id
      and rs.creator_id = auth.uid()
  )
);

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

drop policy if exists comments_select on public.comments;
create policy comments_select
on public.comments
for select
to authenticated
using (public.can_access_session(session_id, auth.uid()));

drop policy if exists comments_insert on public.comments;
create policy comments_insert
on public.comments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_session_member(session_id, auth.uid())
);

drop policy if exists comments_update on public.comments;
create policy comments_update
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists comments_delete on public.comments;
create policy comments_delete
on public.comments
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select
on public.comment_likes
for select
to authenticated
using (
  exists (
    select 1
    from public.comments c
    where c.id = comment_likes.comment_id
      and public.can_access_session(c.session_id, auth.uid())
  )
);

drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert
on public.comment_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.comments c
    where c.id = comment_likes.comment_id
      and public.is_session_member(c.session_id, auth.uid())
  )
);

drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete
on public.comment_likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists session_join_requests_select on public.session_join_requests;
create policy session_join_requests_select
on public.session_join_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_join_requests.session_id
      and rs.creator_id = auth.uid()
  )
);

drop policy if exists session_join_requests_insert on public.session_join_requests;
create policy session_join_requests_insert
on public.session_join_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_join_requests.session_id
      and rs.join_policy = 'request'
  )
);

drop policy if exists session_join_requests_update on public.session_join_requests;
create policy session_join_requests_update
on public.session_join_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_join_requests.session_id
      and rs.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reading_sessions rs
    where rs.id = session_join_requests.session_id
      and rs.creator_id = auth.uid()
  )
  and status in ('pending', 'approved', 'rejected')
);

drop policy if exists session_join_requests_delete on public.session_join_requests;
create policy session_join_requests_delete
on public.session_join_requests
for delete
to authenticated
using (user_id = auth.uid());

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

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('session-media', 'session-media', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('session-covers', 'session-covers', false)
on conflict (id) do nothing;

drop policy if exists storage_session_media_select on storage.objects;
create policy storage_session_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'session-media'
  and exists (
    select 1
    from public.session_media sm
    where sm.file_path = name
      and public.can_access_session(sm.session_id, auth.uid())
  )
);

drop policy if exists storage_session_media_insert on storage.objects;
create policy storage_session_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-media'
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.creator_id = auth.uid()
      and position(rs.id::text || '/' in name) = 1
  )
);

drop policy if exists storage_session_media_delete on storage.objects;
create policy storage_session_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-media'
  and exists (
    select 1
    from public.session_media sm
    join public.reading_sessions rs on rs.id = sm.session_id
    where sm.file_path = name
      and (sm.uploader_id = auth.uid() or rs.creator_id = auth.uid())
  )
);

drop policy if exists storage_session_covers_select on storage.objects;
create policy storage_session_covers_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'session-covers'
  and split_part(name, '/', 2) <> ''
  and public.can_access_session(split_part(name, '/', 2)::uuid, auth.uid())
);

drop policy if exists storage_session_covers_insert on storage.objects;
create policy storage_session_covers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'session-covers'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = split_part(name, '/', 2)::uuid
      and rs.creator_id = auth.uid()
  )
);

drop policy if exists storage_session_covers_update on storage.objects;
create policy storage_session_covers_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'session-covers'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = split_part(name, '/', 2)::uuid
      and rs.creator_id = auth.uid()
  )
)
with check (
  bucket_id = 'session-covers'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = split_part(name, '/', 2)::uuid
      and rs.creator_id = auth.uid()
  )
);

drop policy if exists storage_session_covers_delete on storage.objects;
create policy storage_session_covers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'session-covers'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.reading_sessions rs
    where rs.id = split_part(name, '/', 2)::uuid
      and rs.creator_id = auth.uid()
  )
);

drop policy if exists storage_profile_avatars_select on storage.objects;
create policy storage_profile_avatars_select
on storage.objects
for select
to authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists storage_profile_avatars_insert on storage.objects;
create policy storage_profile_avatars_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists storage_profile_avatars_update on storage.objects;
create policy storage_profile_avatars_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists storage_profile_avatars_delete on storage.objects;
create policy storage_profile_avatars_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);