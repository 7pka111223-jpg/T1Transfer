-- Check-in rules (2026-09-27):
--   * QR check-in is open every day except Friday, 17:00 until 22:00 gym time
--     (Africa/Cairo), whatever the member's level and whether or not they
--     booked a class.
--   * A member checks in at most once per gym day, twice on Mondays, counting
--     every way of checking in (QR, the app's Attend / class buttons, and staff
--     check-ins). Before this, only QR scans were capped and only QR scans were
--     counted, so a QR scan plus a class check-in could use two sessions a day.
--
-- Adds qr_check_in_open, daily_check_in_limit and check_ins_on_gym_day; replaces
-- qr_check_in (last defined in 20260924_qr_daily_limit.sql); and adds a trigger
-- that applies the same daily cap to check-ins the member app inserts directly
-- ('app', 'class', 'kiosk'). Staff check-ins ('admin') are counted but never
-- blocked. A QR scan outside hours or over the cap records nothing and deducts
-- nothing; it returns outside_hours / daily_limit_reached instead.
--
-- Idempotent: safe to re-run.

create or replace function public.qr_check_in_open(p_at timestamptz)
returns boolean
language sql
stable
as $$
  select extract(isodow from (p_at at time zone 'Africa/Cairo')) <> 5  -- Friday
     and (p_at at time zone 'Africa/Cairo')::time >= time '17:00'
     and (p_at at time zone 'Africa/Cairo')::time <  time '22:00'
$$;

grant execute on function public.qr_check_in_open(timestamptz) to anon, authenticated;

-- 1 check-in per gym day, 2 on Mondays.
create or replace function public.daily_check_in_limit(p_at timestamptz)
returns integer
language sql
stable
as $$
  select case when extract(isodow from (p_at at time zone 'Africa/Cairo')) = 1 then 2 else 1 end
$$;

-- Check-ins of any kind the member already has on p_at's gym day.
create or replace function public.check_ins_on_gym_day(p_member_id uuid, p_at timestamptz)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.attendance_records
   where member_id = p_member_id
     and (check_in_time at time zone 'Africa/Cairo')::date = (p_at at time zone 'Africa/Cairo')::date
$$;

grant execute on function public.daily_check_in_limit(timestamptz) to anon, authenticated;
revoke all on function public.check_ins_on_gym_day(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.qr_check_in(
  p_member_id uuid,
  p_branch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_limit integer;
  v_scans_today integer;
  v_member_exists boolean;
  v_attendance_id uuid;
  v_duplicate boolean := false;
  v_limit_reached boolean := false;
  v_outside_hours boolean := false;
  v_sub_id uuid;
  v_is_shared boolean := false;
  v_sub_type text;
  v_is_session boolean := false;
  v_remaining integer;
  v_end_date date;
begin
  if p_member_id is null then
    raise exception 'member_required';
  end if;

  -- Serialise check-ins for this member (shared with the trigger below) so the
  -- daily count cannot race.
  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 42));

  select true into v_member_exists from public.members where id = p_member_id;
  if not coalesce(v_member_exists, false) then
    raise exception 'member_not_found';
  end if;

  v_daily_limit := public.daily_check_in_limit(now());
  v_scans_today := public.check_ins_on_gym_day(p_member_id, now());

  -- Same visit: a QR scan inside the dedupe window is the original check-in.
  select id into v_attendance_id
    from public.attendance_records
   where member_id = p_member_id
     and check_in_method = 'qr'
     and check_in_time > now() - interval '2 minutes'
   order by check_in_time desc
   limit 1;

  if v_attendance_id is not null then
    v_duplicate := true;
  elsif not public.qr_check_in_open(now()) then
    v_outside_hours := true;
  elsif v_scans_today >= v_daily_limit then
    v_limit_reached := true;
  else
    insert into public.attendance_records (member_id, check_in_time, check_in_method, branch_id)
    values (p_member_id, now(), 'qr', p_branch_id)
    returning id into v_attendance_id;
    v_scans_today := v_scans_today + 1;
  end if;

  -- Resolve which subscription a session should come from: an active personal
  -- subscription first, otherwise an active shared pool the member belongs to.
  select ms.id, ms.sessions_remaining, ms.end_date, p.type
    into v_sub_id, v_remaining, v_end_date, v_sub_type
    from public.member_subscriptions ms
    join public.subscription_packages p on p.id = ms.package_id
   where ms.member_id = p_member_id
     and ms.status = 'active'
   order by ms.end_date desc nulls last
   limit 1;

  if v_sub_id is null then
    select ss.id, ss.sessions_remaining, ss.end_date, p.type
      into v_sub_id, v_remaining, v_end_date, v_sub_type
      from public.shared_subscription_members ssm
      join public.shared_subscriptions ss on ss.id = ssm.shared_subscription_id
      join public.subscription_packages p on p.id = ss.package_id
     where ssm.member_id = p_member_id
       and ss.status = 'active'
     order by ss.end_date desc nulls last
     limit 1;
    v_is_shared := v_sub_id is not null;
  end if;

  v_is_session := (v_sub_type = 'session');

  if not v_duplicate and not v_limit_reached and not v_outside_hours
     and v_is_session and v_sub_id is not null and coalesce(v_remaining, 0) > 0 then
    if v_is_shared then
      update public.shared_subscriptions
         set sessions_remaining = sessions_remaining - 1
       where id = v_sub_id
      returning sessions_remaining into v_remaining;
    else
      update public.member_subscriptions
         set sessions_remaining = sessions_remaining - 1
       where id = v_sub_id
      returning sessions_remaining into v_remaining;
    end if;

    -- Audit row; never let a ledger problem fail the check-in itself.
    begin
      insert into public.session_deductions
        (member_id, source_type, source_id, attendance_id, amount, action, created_at)
      values
        (p_member_id, case when v_is_shared then 'shared' else 'personal' end,
         v_sub_id, v_attendance_id, 1, 'deduct', now());
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'attendance_id', v_attendance_id,
    'duplicate', v_duplicate,
    'outside_hours', v_outside_hours,
    'daily_limit_reached', v_limit_reached,
    'scans_today', v_scans_today,
    'daily_limit', v_daily_limit,
    'is_session_based', v_is_session,
    'is_shared', v_is_shared,
    'sessions_remaining', v_remaining,
    'expiry_date', v_end_date
  );
end;
$$;

grant execute on function public.qr_check_in(uuid, uuid) to anon, authenticated;

-- The member app inserts 'app' / 'class' / 'kiosk' check-ins directly; hold
-- them to the same daily cap. Uses the same per-member lock as qr_check_in.
create or replace function public.enforce_daily_check_in_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz := coalesce(new.check_in_time, now());
  v_limit integer := public.daily_check_in_limit(v_at);
begin
  if new.member_id is null or new.check_in_method not in ('app', 'class', 'kiosk') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.member_id::text, 42));

  if public.check_ins_on_gym_day(new.member_id, v_at) >= v_limit then
    raise exception 'daily_limit_reached'
      using errcode = 'P0001', detail = v_limit::text;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_daily_check_in_limit on public.attendance_records;
create trigger enforce_daily_check_in_limit
  before insert on public.attendance_records
  for each row execute function public.enforce_daily_check_in_limit();
