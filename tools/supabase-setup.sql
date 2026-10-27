-- ENDURA accounts, friends, close friends and 2FA - run in the Supabase SQL editor.
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

-- close friends: one flag per friendship, set by either side, mutual.
alter table public.friendships add column if not exists close boolean not null default false;

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

-- Either side can mark the pair close. Done in a SECURITY DEFINER function so
-- the only thing the column update can touch is `close` on an accepted pair -
-- a plain update policy would also let a requester accept their own request.
create or replace function public.set_close_friend(p_other uuid, p_on boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.friendships
     set close = p_on
   where status = 'accepted'
     and ((requester = auth.uid() and addressee = p_other)
       or (addressee = auth.uid() and requester = p_other));
$$;

revoke all on function public.set_close_friend(uuid, boolean) from public;
grant execute on function public.set_close_friend(uuid, boolean) to authenticated;

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

-- --------------------------------------------------------- shared weeks
-- One row per user: the summary their app chose to publish. When a section is
-- switched off in the app it is never written here, so the server cannot leak
-- it. Turning sharing off deletes the row.
create table if not exists public.shared_weeks (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  from_date  date not null,
  to_date    date not null,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shared_weeks enable row level security;

-- Read: yourself, or someone you are in a close, accepted friendship with.
drop policy if exists "read own or close friend week" on public.shared_weeks;
create policy "read own or close friend week"
  on public.shared_weeks for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.friendships f
       where f.status = 'accepted'
         and f.close
         and ((f.requester = auth.uid() and f.addressee = shared_weeks.user_id)
           or (f.addressee = auth.uid() and f.requester = shared_weeks.user_id))
    )
  );

drop policy if exists "write own week" on public.shared_weeks;
create policy "write own week"
  on public.shared_weeks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "update own week" on public.shared_weeks;
create policy "update own week"
  on public.shared_weeks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own week" on public.shared_weeks;
create policy "delete own week"
  on public.shared_weeks for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- 2FA
-- Authenticator-app (TOTP) factors are handled by Supabase Auth itself;
-- no table needed. Phone/SMS 2FA needs an SMS provider (Twilio) connected in
-- Authentication -> Sign In / Providers -> Phone.
