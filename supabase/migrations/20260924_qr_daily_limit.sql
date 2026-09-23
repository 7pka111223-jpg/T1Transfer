-- Hard daily cap on QR check-ins.
--
-- Business rule: a member may be checked in by QR at most once per day, so at
-- most one session is deducted per day. Mondays are the exception: up to two QR
-- check-ins, so up to two sessions.
--
-- Replaces public.qr_check_in (created in 20260923_atomic_qr_checkin.sql) with
-- the same atomic/idempotent behaviour plus the daily cap. "Day" is the gym's
-- local calendar day (Africa/Cairo), not UTC, so the 19:00-21:00 sessions do not
-- roll over at 21:00/22:00 UTC. The short same-visit window still collapses an
-- accidental repeat scan into the original check-in and never counts twice.
--
-- Idempotent: safe to re-run.

create or replace function public.qr_check_in(
  p_member_id uuid,
  p_branch_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'Africa/Cairo';
  v_today date;
  v_daily_limit integer;
  v_scans_today integer;
  v_member_exists boolean;
  v_attendance_id uuid;
  v_duplicate boolean := false;
  v_limit_reached boolean := false;
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

  -- Serialise check-ins for this member so the counts below cannot race.
  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 42));

  select true into v_member_exists from public.members where id = p_member_id;
  if not coalesce(v_member_exists, false) then
    raise exception 'member_not_found';
  end if;

  v_today := (now() at time zone v_tz)::date;
  v_daily_limit := case when extract(isodow from (now() at time zone v_tz)) = 1 then 2 else 1 end;

  select count(*) into v_scans_today
    from public.attendance_records
   where member_id = p_member_id
     and check_in_method = 'qr'
     and (check_in_time at time zone v_tz)::date = v_today;

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

  if not v_duplicate and not v_limit_reached
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
