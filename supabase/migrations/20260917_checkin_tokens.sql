-- QR attendance check-in: short-lived venue tokens redeemed server-side.
-- Idempotent: safe to re-run.

create table if not exists public.checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  branch_id uuid references public.branches(id),
  created_by_admin_id uuid references public.admins(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists checkin_tokens_token_idx on public.checkin_tokens (token);
create index if not exists checkin_tokens_expires_at_idx on public.checkin_tokens (expires_at);

alter table public.attendance_records
  add column if not exists branch_id uuid references public.branches(id);

-- No anon policies: the table is only reachable through the security-definer
-- functions below, so members can neither list nor guess live tokens.
alter table public.checkin_tokens enable row level security;

create or replace function public.create_checkin_token(
  p_branch_id uuid default null,
  p_admin_id uuid default null,
  p_ttl_seconds integer default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_expires timestamptz;
begin
  v_token := replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(secs => greatest(10, least(coalesce(p_ttl_seconds, 60), 900)));

  insert into public.checkin_tokens (token, branch_id, created_by_admin_id, expires_at)
  values (v_token, p_branch_id, p_admin_id, v_expires);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function public.redeem_checkin_token(
  p_token text,
  p_member_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.checkin_tokens%rowtype;
  v_status text;
  v_attendance_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'invalid_token';
  end if;

  select * into v_row from public.checkin_tokens where token = trim(p_token) limit 1;
  if not found then
    raise exception 'invalid_token';
  end if;

  if v_row.expires_at < now() then
    raise exception 'expired_token';
  end if;

  select status into v_status from public.members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;
  if v_status is distinct from 'active' then
    raise exception 'member_inactive';
  end if;

  -- Ignore repeat scans (double-tap, camera re-decode) inside a short window.
  select id into v_attendance_id
  from public.attendance_records
  where member_id = p_member_id
    and check_in_time > now() - interval '2 minutes'
  order by check_in_time desc
  limit 1;

  if v_attendance_id is not null then
    return jsonb_build_object('attendance_id', v_attendance_id, 'branch_id', v_row.branch_id, 'duplicate', true);
  end if;

  insert into public.attendance_records (member_id, check_in_time, check_in_method, branch_id)
  values (p_member_id, now(), 'qr', v_row.branch_id)
  returning id into v_attendance_id;

  return jsonb_build_object('attendance_id', v_attendance_id, 'branch_id', v_row.branch_id, 'duplicate', false);
end;
$$;

grant execute on function public.create_checkin_token(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.redeem_checkin_token(text, uuid) to anon, authenticated;
