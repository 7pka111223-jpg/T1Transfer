-- Move PIN checks to the server and stop exposing PINs to the browser.
--
-- Until now members.pin and admins.pin were plaintext columns readable with the
-- public anon key, and the login screens fetched the row and compared the PIN
-- in the browser. Anyone could read every PIN over the REST API, and an admin
-- "session" was just an admins.id in localStorage, which is also public.
--
-- After this migration:
--   * PINs live only as bcrypt hashes in member_credentials / admin_credentials,
--     tables with RLS on, no policies and no grants to anon/authenticated.
--   * The plaintext pin columns are emptied (kept, always null, so older
--     clients selecting them don't error). A trigger stops browser roles from
--     writing a PIN back into them.
--   * Login, activation, PIN reset and logout go through security-definer RPCs.
--     A successful login returns a random session token; only its sha256 is
--     stored. Sessions never expire (owner decision, see the 2026-09-19
--     persistent-login spec); logout or a PIN reset deletes them.
--   * 5 wrong PINs in a row lock that login for 15 minutes.
--   * Browser roles can no longer move a member into or out of 'pending'
--     directly, so an account can't be reset and re-activated by a stranger.
--
-- Not covered here: the other tables are still readable/writable with the anon
-- key. Closing that needs real per-user auth + RLS on every table.
--
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Credential and session tables (no browser access at all)
-- ---------------------------------------------------------------------------

create table if not exists public.member_credentials (
  member_id uuid primary key references public.members (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_credentials (
  admin_id uuid primary key references public.admins (id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_sessions (
  token_hash text primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  token_hash text primary key,
  admin_id uuid not null references public.admins (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.member_credentials enable row level security;
alter table public.admin_credentials enable row level security;
alter table public.member_sessions enable row level security;
alter table public.admin_sessions enable row level security;

revoke all on public.member_credentials, public.admin_credentials,
              public.member_sessions, public.admin_sessions
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill hashes from the plaintext columns, then empty them
-- ---------------------------------------------------------------------------

insert into public.member_credentials (member_id, pin_hash)
select id, extensions.crypt(pin, extensions.gen_salt('bf', 8))
  from public.members
 where pin is not null and pin <> ''
on conflict (member_id) do nothing;

insert into public.admin_credentials (admin_id, pin_hash)
select id, extensions.crypt(pin, extensions.gen_salt('bf', 8))
  from public.admins
 where pin is not null and pin <> ''
on conflict (admin_id) do nothing;

update public.members set pin = null where pin is not null;
update public.admins set pin = null where pin is not null;

-- ---------------------------------------------------------------------------
-- Guards against browser roles writing PINs or flipping 'pending'
-- ---------------------------------------------------------------------------

create or replace function public.guard_member_writes()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.pin is not null then
      raise exception 'pin_write_forbidden' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and new.status is distinct from old.status
       and (new.status = 'pending' or old.status = 'pending') then
      raise exception 'status_change_forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_member_writes on public.members;
create trigger guard_member_writes
  before insert or update on public.members
  for each row execute function public.guard_member_writes();

create or replace function public.guard_admin_writes()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') and new.pin is not null then
    raise exception 'pin_write_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_admin_writes on public.admins;
create trigger guard_admin_writes
  before insert or update on public.admins
  for each row execute function public.guard_admin_writes();

-- ---------------------------------------------------------------------------
-- Helpers (not callable from the browser)
-- ---------------------------------------------------------------------------

create or replace function public._hash_token(p_token text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create or replace function public._new_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

-- Admin id for a live admin session token, or null.
create or replace function public._admin_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select admin_id from public.admin_sessions
   where p_token is not null and token_hash = public._hash_token(p_token)
$$;

-- Member JSON without the pin column.
create or replace function public._member_json(p_member public.members)
returns jsonb
language sql
immutable
as $$
  select to_jsonb(p_member) - 'pin'
$$;

revoke all on function public._hash_token(text), public._new_token(),
                       public._admin_for_token(text),
                       public._member_json(public.members)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Member RPCs
-- ---------------------------------------------------------------------------

-- Returns {token, member} on success or {error: not_found|pending|invalid_pin|locked}.
create or replace function public.member_login(p_member_code text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member public.members;
  v_cred public.member_credentials;
  v_token text;
begin
  select * into v_member from public.members
   where member_id = upper(trim(coalesce(p_member_code, '')));
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_member.status = 'pending' then
    return jsonb_build_object('error', 'pending');
  end if;

  select * into v_cred from public.member_credentials
   where member_id = v_member.id
   for update;
  if not found then
    return jsonb_build_object('error', 'invalid_pin');
  end if;
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return jsonb_build_object('error', 'locked');
  end if;

  if v_cred.pin_hash <> extensions.crypt(coalesce(p_pin, ''), v_cred.pin_hash) then
    update public.member_credentials
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5
                               then now() + interval '15 minutes' end
     where member_id = v_member.id;
    return jsonb_build_object('error', 'invalid_pin');
  end if;

  update public.member_credentials
     set failed_attempts = 0, locked_until = null
   where member_id = v_member.id;

  v_token := public._new_token();
  insert into public.member_sessions (token_hash, member_id)
  values (public._hash_token(v_token), v_member.id);

  return jsonb_build_object('token', v_token, 'member', public._member_json(v_member));
end;
$$;

-- Member JSON for a live session, or null. Pending members have no session.
create or replace function public.member_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public._member_json(m)
    from public.member_sessions s
    join public.members m on m.id = s.member_id
   where p_token is not null
     and s.token_hash = public._hash_token(p_token)
     and m.status <> 'pending'
$$;

-- Step 1 of activation: {ok: true} or {error: not_found|already_active|phone_mismatch}.
create or replace function public.check_member_activation(p_member_code text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_member public.members;
  v_given text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_stored text;
begin
  select * into v_member from public.members
   where member_id = upper(trim(coalesce(p_member_code, '')));
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_member.status <> 'pending' then
    return jsonb_build_object('error', 'already_active');
  end if;

  -- Same number with or without a country/trunk prefix, at least 8 digits.
  v_stored := regexp_replace(coalesce(v_member.phone, ''), '\D', '', 'g');
  if length(v_given) < 8 or length(v_stored) < 8
     or not (v_stored like '%' || v_given or v_given like '%' || v_stored) then
    return jsonb_build_object('error', 'phone_mismatch');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Step 2 of activation: re-checks step 1, stores the hashed PIN, activates.
create or replace function public.activate_member(p_member_code text, p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_check jsonb;
  v_member_id uuid;
begin
  if coalesce(p_pin, '') !~ '^\d{4}$' then
    return jsonb_build_object('error', 'invalid_pin_format');
  end if;

  v_check := public.check_member_activation(p_member_code, p_phone);
  if v_check ? 'error' then
    return v_check;
  end if;

  select id into v_member_id from public.members
   where member_id = upper(trim(p_member_code))
   for update;

  insert into public.member_credentials (member_id, pin_hash)
  values (v_member_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0,
        locked_until = null, updated_at = now();

  update public.members set status = 'active' where id = v_member_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

-- Returns {token, admin: {id, full_name, email}} or {error: invalid|locked}.
create or replace function public.admin_login(p_username text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.admins;
  v_cred public.admin_credentials;
  v_token text;
begin
  select * into v_admin from public.admins
   where lower(username) = lower(trim(coalesce(p_username, '')));
  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;

  select * into v_cred from public.admin_credentials
   where admin_id = v_admin.id
   for update;
  if not found then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return jsonb_build_object('error', 'locked');
  end if;

  if v_cred.pin_hash <> extensions.crypt(coalesce(p_pin, ''), v_cred.pin_hash) then
    update public.admin_credentials
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5
                               then now() + interval '15 minutes' end
     where admin_id = v_admin.id;
    return jsonb_build_object('error', 'invalid');
  end if;

  update public.admin_credentials
     set failed_attempts = 0, locked_until = null
   where admin_id = v_admin.id;

  v_token := public._new_token();
  insert into public.admin_sessions (token_hash, admin_id)
  values (public._hash_token(v_token), v_admin.id);

  return jsonb_build_object(
    'token', v_token,
    'admin', jsonb_build_object(
      'id', v_admin.id,
      'full_name', coalesce(v_admin.full_name, v_admin.username),
      'email', coalesce(v_admin.email, '')
    )
  );
end;
$$;

-- {id, full_name, email} for a live admin session, or null.
create or replace function public.admin_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
           'id', a.id,
           'full_name', coalesce(a.full_name, a.username),
           'email', coalesce(a.email, '')
         )
    from public.admins a
   where a.id = public._admin_for_token(p_token)
$$;

-- Admin-only: clears a member's PIN and sessions and sends them back to activation.
create or replace function public.admin_reset_member_pin(p_token text, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public._admin_for_token(p_token) is null then
    return jsonb_build_object('error', 'not_admin');
  end if;

  delete from public.member_credentials where member_id = p_member_id;
  delete from public.member_sessions where member_id = p_member_id;
  update public.members set status = 'pending' where id = p_member_id;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Ends whichever session the token belongs to. Always succeeds.
create or replace function public.end_session(p_token text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.member_sessions where token_hash = public._hash_token(p_token);
  delete from public.admin_sessions where token_hash = public._hash_token(p_token);
$$;

-- Owner-only (SQL editor / service role): set or change an admin's PIN.
--   select public.set_admin_pin('username', '1234');
create or replace function public.set_admin_pin(p_username text, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin_id uuid;
begin
  if coalesce(p_pin, '') !~ '^\d{4,}$' then
    raise exception 'PIN must be at least 4 digits';
  end if;
  select id into v_admin_id from public.admins
   where lower(username) = lower(trim(p_username));
  if v_admin_id is null then
    raise exception 'No admin with username %', p_username;
  end if;

  insert into public.admin_credentials (admin_id, pin_hash)
  values (v_admin_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (admin_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0,
        locked_until = null, updated_at = now();
  delete from public.admin_sessions where admin_id = v_admin_id;
end;
$$;

revoke all on function
  public.member_login(text, text),
  public.member_session(text),
  public.check_member_activation(text, text),
  public.activate_member(text, text, text),
  public.admin_login(text, text),
  public.admin_session(text),
  public.admin_reset_member_pin(text, uuid),
  public.end_session(text),
  public.set_admin_pin(text, text)
  from public, anon, authenticated;

grant execute on function
  public.member_login(text, text),
  public.member_session(text),
  public.check_member_activation(text, text),
  public.activate_member(text, text, text),
  public.admin_login(text, text),
  public.admin_session(text),
  public.admin_reset_member_pin(text, uuid),
  public.end_session(text)
  to anon, authenticated;
