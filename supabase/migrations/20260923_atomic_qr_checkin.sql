-- Make QR attendance check-in atomic and idempotent.
--
-- The member app used to do the whole check-in client-side: a non-atomic
-- "recent attendance?" read, an attendance insert, then a read-then-write
-- decrement of the subscription's sessions_remaining. Overlapping calls (the
-- camera scanner emitted a callback for every frame the code was visible, and
-- deep-link handling could run more than once) could each insert attendance and
-- each deduct a session, so a single scan sometimes consumed two sessions.
--
-- This function does the whole thing in one transaction:
--   * serialises concurrent calls for the same member (advisory lock), so the
--     duplicate check cannot race;
--   * treats any check-in inside the dedupe window as the same visit and
--     returns it without consuming another session;
--   * decrements sessions_remaining with a single atomic UPDATE.
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
  v_member_exists boolean;
  v_attendance_id uuid;
  v_duplicate boolean := false;
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

  -- Serialise check-ins for this member so the dedupe check below is race-free.
  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text, 42));

  select true into v_member_exists from public.members where id = p_member_id;
  if not coalesce(v_member_exists, false) then
    raise exception 'member_not_found';
  end if;

  -- A check-in inside the dedupe window is the same visit: reuse it, deduct nothing.
  select id into v_attendance_id
    from public.attendance_records
   where member_id = p_member_id
     and check_in_time > now() - interval '2 minutes'
   order by check_in_time desc
   limit 1;

  if v_attendance_id is not null then
    v_duplicate := true;
  else
    insert into public.attendance_records (member_id, check_in_time, check_in_method, branch_id)
    values (p_member_id, now(), 'qr', p_branch_id)
    returning id into v_attendance_id;
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

  if not v_duplicate and v_is_session and v_sub_id is not null and coalesce(v_remaining, 0) > 0 then
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
    'is_session_based', v_is_session,
    'is_shared', v_is_shared,
    'sessions_remaining', v_remaining,
    'expiry_date', v_end_date
  );
end;
$$;

grant execute on function public.qr_check_in(uuid, uuid) to anon, authenticated;
