create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  creator_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  cover_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.category_members (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  unique (category_id, user_id)
);

create table if not exists public.session_categories (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, category_id)
);

create table if not exists public.session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'book_file')),
  file_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_creator on public.categories(creator_id);
create index if not exists idx_categories_visibility on public.categories(visibility);

create index if not exists idx_category_members_category on public.category_members(category_id);
create index if not exists idx_category_members_user on public.category_members(user_id);
create index if not exists idx_category_members_user_category on public.category_members(user_id, category_id);

create index if not exists idx_session_categories_session on public.session_categories(session_id);
create index if not exists idx_session_categories_category on public.session_categories(category_id);

create index if not exists idx_session_media_session on public.session_media(session_id);
create index if not exists idx_session_media_uploader on public.session_media(uploader_id);

create index if not exists idx_comments_session on public.comments(session_id);
create index if not exists idx_comment_likes_comment on public.comment_likes(comment_id);
create index if not exists idx_progress_updates_session on public.progress_updates(session_id);
create index if not exists idx_session_members_session on public.session_members(session_id);
create index if not exists idx_session_members_user on public.session_members(user_id);
create index if not exists idx_session_join_requests_session on public.session_join_requests(session_id);

create or replace function public.is_category_member(
  p_category_id uuid,
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
    from public.category_members cm
    where cm.category_id = p_category_id
      and cm.user_id = p_user_id
  );
end;
$$;

create or replace function public.is_category_owner(
  p_category_id uuid,
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
    from public.categories c
    where c.id = p_category_id
      and c.creator_id = p_user_id
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
    select 1 from public.reading_sessions rs
    where rs.id = p_session_id
      and (
        rs.visibility = 'public'
        or rs.creator_id = p_user_id
        or exists (
          select 1 from public.session_members sm
          where sm.session_id = rs.id and sm.user_id = p_user_id
        )
        or exists (
          select 1 from public.session_categories sc
          join public.category_members cm on cm.category_id = sc.category_id
          where sc.session_id = rs.id and cm.user_id = p_user_id
        )
      )
  );
end;
$$;

revoke all on function public.is_category_member(uuid, uuid) from public;
grant execute on function public.is_category_member(uuid, uuid) to authenticated;

revoke all on function public.is_category_owner(uuid, uuid) from public;
grant execute on function public.is_category_owner(uuid, uuid) to authenticated;

revoke all on function public.can_access_session(uuid, uuid) from public;
grant execute on function public.can_access_session(uuid, uuid) to authenticated;

alter table public.categories enable row level security;
alter table public.category_members enable row level security;
alter table public.session_categories enable row level security;
alter table public.session_media enable row level security;

create policy "Public categories readable by authenticated"
on public.categories for select
using (
  auth.role() = 'authenticated'
  and (
    visibility = 'public'
    or creator_id = auth.uid()
    or public.is_category_member(categories.id, auth.uid())
  )
);

create policy "Authenticated users can create categories"
on public.categories for insert
with check (
  auth.role() = 'authenticated'
  and creator_id = auth.uid()
  and visibility in ('public', 'private')
);

create policy "Owner can update own categories"
on public.categories for update
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "Owner can delete own categories"
on public.categories for delete
using (auth.uid() = creator_id);

create policy "Category members readable by members or public category"
on public.category_members for select
using (
  auth.role() = 'authenticated'
  and (
    user_id = auth.uid()
    or public.is_category_member(category_members.category_id, auth.uid())
    or exists (
      select 1 from public.categories c
      where c.id = category_members.category_id
        and c.visibility = 'public'
    )
  )
);

create policy "Users can join public categories or be added by owner"
on public.category_members for insert
with check (
  auth.role() = 'authenticated'
  and (
    (user_id = auth.uid() and exists (
      select 1 from public.categories c
      where c.id = category_members.category_id
        and c.visibility = 'public'
    ))
    or public.is_category_owner(category_members.category_id, auth.uid())
  )
);

create policy "Users can leave or owner can remove"
on public.category_members for delete
using (
  auth.uid() = user_id
  or public.is_category_owner(category_members.category_id, auth.uid())
);

create policy "Session categories readable if session accessible"
on public.session_categories for select
using (
  auth.role() = 'authenticated'
  and public.can_access_session(session_categories.session_id, auth.uid())
);

create policy "Session owner can link categories"
on public.session_categories for insert
with check (
  auth.role() = 'authenticated'
  and exists (
    select 1 from public.reading_sessions rs
    where rs.id = session_categories.session_id
      and rs.creator_id = auth.uid()
  )
);

create policy "Session owner can unlink categories"
on public.session_categories for delete
using (
  exists (
    select 1 from public.reading_sessions rs
    where rs.id = session_categories.session_id
      and rs.creator_id = auth.uid()
  )
);

create policy "Media readable if session accessible"
on public.session_media for select
using (
  auth.role() = 'authenticated'
  and public.can_access_session(session_media.session_id, auth.uid())
);

create policy "Session owner can upload media up to chapter limit"
on public.session_media for insert
with check (
  auth.role() = 'authenticated'
  and uploader_id = auth.uid()
  and media_type in ('image', 'book_file')
  and exists (
    select 1 from public.reading_sessions rs
    where rs.id = session_media.session_id
      and rs.creator_id = auth.uid()
  )
  and (
    select count(*) from public.session_media sm
    where sm.session_id = session_media.session_id
  ) < (
    select rs.total_chapters from public.reading_sessions rs
    where rs.id = session_media.session_id
  )
);

create policy "Uploader or session owner can delete media"
on public.session_media for delete
using (
  uploader_id = auth.uid()
  or exists (
    select 1 from public.reading_sessions rs
    where rs.id = session_media.session_id
      and rs.creator_id = auth.uid()
  )
);

do $$
declare
  v_default_category_id uuid;
  v_first_user_id uuid;
begin
  select id into v_first_user_id from public.profiles limit 1;

  if v_first_user_id is not null then
    if not exists (select 1 from public.categories) then
      insert into public.categories (name, description, visibility, creator_id)
      values ('General', 'Default category for all reading sessions', 'public', v_first_user_id)
      returning id into v_default_category_id;

      insert into public.category_members (category_id, user_id, role)
      values (v_default_category_id, v_first_user_id, 'owner')
      on conflict (category_id, user_id) do nothing;

      insert into public.session_categories (session_id, category_id)
      select rs.id, v_default_category_id
      from public.reading_sessions rs
      on conflict (session_id, category_id) do nothing;
    end if;
  end if;
end;
$$;
