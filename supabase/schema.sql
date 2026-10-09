create table if not exists public.leader_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null check (role in ('leader', 'minister')),
  active boolean not null default true,
  profile_picture_updated_at timestamptz
);

alter table public.leader_profiles enable row level security;
revoke all on table public.leader_profiles from anon, authenticated;
grant select (user_id, display_name, role, active, profile_picture_updated_at) on public.leader_profiles to authenticated;
grant update (profile_picture_updated_at) on public.leader_profiles to authenticated;
drop policy if exists "leaders can read their own profile" on public.leader_profiles;
drop policy if exists "leaders can update their own avatar timestamp" on public.leader_profiles;
create policy "leaders can read their own profile"
  on public.leader_profiles for select to authenticated
  using (user_id = (select auth.uid()) and active);
create policy "leaders can update their own avatar timestamp"
  on public.leader_profiles for update to authenticated
  using (user_id = (select auth.uid()) and active)
  with check (user_id = (select auth.uid()) and active);

create table if not exists public.app_state (
  id text primary key check (id = 'community'),
  data jsonb not null,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
revoke all on table public.app_state from anon, authenticated;
grant select, insert, update on table public.app_state to authenticated;
drop policy if exists "active leaders can read community data" on public.app_state;
drop policy if exists "active leaders can create community data" on public.app_state;
drop policy if exists "active leaders can update community data" on public.app_state;
create policy "active leaders can read community data"
  on public.app_state for select to authenticated
  using (exists (
    select 1 from public.leader_profiles
    where leader_profiles.user_id = (select auth.uid()) and leader_profiles.active
  ));
create policy "active leaders can create community data"
  on public.app_state for insert to authenticated
  with check (exists (
    select 1 from public.leader_profiles
    where leader_profiles.user_id = (select auth.uid()) and leader_profiles.active
  ) and updated_by = (select auth.uid()));
create policy "active leaders can update community data"
  on public.app_state for update to authenticated
  using (exists (
    select 1 from public.leader_profiles
    where leader_profiles.user_id = (select auth.uid()) and leader_profiles.active
  ))
  with check (exists (
    select 1 from public.leader_profiles
    where leader_profiles.user_id = (select auth.uid()) and leader_profiles.active
  ) and updated_by = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leader-avatars', 'leader-avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

drop policy if exists "leaders can read their own avatar" on storage.objects;
drop policy if exists "leaders can upload their own avatar" on storage.objects;
drop policy if exists "leaders can replace their own avatar" on storage.objects;
drop policy if exists "leaders can delete their own avatar" on storage.objects;
create policy "leaders can read their own avatar"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'leader-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.leader_profiles where user_id = (select auth.uid()) and active)
  );
create policy "leaders can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'leader-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.leader_profiles where user_id = (select auth.uid()) and active)
  );
create policy "leaders can replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'leader-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.leader_profiles where user_id = (select auth.uid()) and active)
  )
  with check (
    bucket_id = 'leader-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.leader_profiles where user_id = (select auth.uid()) and active)
  );
create policy "leaders can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'leader-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.leader_profiles where user_id = (select auth.uid()) and active)
  );