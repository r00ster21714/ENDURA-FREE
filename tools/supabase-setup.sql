-- ENDURA accounts + friends — run once in the Supabase SQL editor.
-- Safe to re-run: every object is created only if missing, policies are replaced.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text default '',
  created_at   timestamptz not null default now()
);

-- usernames are unique regardless of case
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------- friendships
create table if not exists public.friendships (
  requester  uuid not null references public.profiles (id) on delete cascade,
  addressee  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships enable row level security;

drop policy if exists "read own friendships" on public.friendships;
create policy "read own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);

drop policy if exists "send request" on public.friendships;
create policy "send request"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester and status = 'pending');

drop policy if exists "accept request" on public.friendships;
create policy "accept request"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee) with check (auth.uid() = addressee);

drop policy if exists "delete own friendship" on public.friendships;
create policy "delete own friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester or auth.uid() = addressee);

-- ------------------------------------------------------- username helpers
-- Called before signup so a taken name fails early instead of at the trigger.
create or replace function public.username_taken(u text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where lower(username) = lower(u));
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;

-- Every new auth user gets a profile row; username comes from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8))))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- 2FA
-- Authenticator-app (TOTP) factors are handled by Supabase Auth itself;
-- no table needed. Phone/SMS 2FA requires an SMS provider (Twilio) in
-- Authentication → Providers → Phone.
