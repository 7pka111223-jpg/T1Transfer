-- Staff accounts that don't take attendance (2026-09-29).
--
-- admins.tracks_attendance (default true) marks who appears on the Coaches
-- tab: the weekly schedule editor, the attendance report and the CSV export.
-- 'baza' is a full admin who does not check in, so it is switched off and any
-- schedule or attendance rows it had are removed. The browser cannot change
-- the flag; to change it later, as the owner in the SQL editor:
--   update public.admins set tracks_attendance = false where username = '...';
--
-- Depends on 20260928_coach_attendance.sql and 20260929_coach_report_year_range.sql.
-- Idempotent: safe to re-run.

alter table public.admins add column if not exists tracks_attendance boolean not null default true;

update public.admins set tracks_attendance = false where lower(username) = 'baza' and tracks_attendance;

delete from public.coach_schedule
 where admin_id in (select id from public.admins where not tracks_attendance);
delete from public.coach_attendance
 where admin_id in (select id from public.admins where not tracks_attendance);

-- Browser roles may not change the flag either.
create or replace function public.guard_admin_writes()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op in ('INSERT', 'DELETE') then
      raise exception 'admin_write_forbidden' using errcode = '42501';
    end if;
    if new.pin is not null then
      raise exception 'pin_write_forbidden' using errcode = '42501';
    end if;
    if new.role is distinct from old.role then
      raise exception 'role_change_forbidden' using errcode = '42501';
    end if;
    if new.tracks_attendance is distinct from old.tracks_attendance then
      raise exception 'attendance_flag_change_forbidden' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

-- Only staff who take attendance: listed, schedulable, reported, overridable.
-- Staff who take attendance, with each person's weekly session times:
-- [{id, full_name, username, role, schedule: {"0": "18:00", ...}}].
create or replace function public.coach_schedule_list(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if public._full_admin_for_token(p_token) is null then
    return jsonb_build_object('error', 'not_admin');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'full_name', coalesce(a.full_name, a.username),
             'username', a.username,
             'role', a.role,
             'schedule', coalesce((
               select jsonb_object_agg(s.weekday::text, to_char(s.session_time, 'HH24:MI'))
                 from public.coach_schedule s where s.admin_id = a.id), '{}'::jsonb)
           ) order by a.role desc, coalesce(a.full_name, a.username))
      from public.admins a
     where a.tracks_attendance
  ), '[]'::jsonb);
end;
$$;

-- Set (p_time) or clear (p_time null) one weekday's session time.
create or replace function public.coach_schedule_set(p_token text, p_admin_id uuid,
                                                     p_weekday smallint, p_time time)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public._full_admin_for_token(p_token) is null then
    return jsonb_build_object('error', 'not_admin');
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 then
    return jsonb_build_object('error', 'invalid_weekday');
  end if;
  if not exists (select 1 from public.admins where id = p_admin_id and tracks_attendance) then
    return jsonb_build_object('error', 'not_found');
  end if;

  if p_time is null then
    delete from public.coach_schedule where admin_id = p_admin_id and weekday = p_weekday;
  else
    insert into public.coach_schedule (admin_id, weekday, session_time, created_at)
    values (p_admin_id, p_weekday, p_time, public._clock())
    on conflict (admin_id, weekday) do update
      set session_time = excluded.session_time, updated_at = public._clock();
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Attendance for every scheduled day in [p_from, p_to] (gym dates, up to a year):
-- [{admin_id, full_name, gym_date, session_time, status, checked_in_at,
--   distance_m, note, override_by_name}], status one of present | override |
-- missed (window closed, no check-in) | open (window open now) | upcoming.
-- A weekday only counts from the day its schedule entry was created.
create or replace function public.coach_attendance_report(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if public._full_admin_for_token(p_token) is null then
    return jsonb_build_object('error', 'not_admin');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    return jsonb_build_object('error', 'invalid_range');
  end if;

  return coalesce((
    with days as (
      select d::date as gym_date from generate_series(p_from, p_to, interval '1 day') d
    ),
    expected as (
      select a.id as admin_id, coalesce(a.full_name, a.username) as full_name, d.gym_date,
             s.session_time, w.opens_at, w.closes_at
        from days d
        join public.coach_schedule s on s.weekday = extract(dow from d.gym_date)
        join public.admins a on a.id = s.admin_id and a.tracks_attendance
        cross join lateral public._coach_window(d.gym_date, s.session_time) w
       where d.gym_date >= (s.created_at at time zone 'Africa/Cairo')::date
    ),
    report as (
      select e.admin_id, e.full_name, e.gym_date, coalesce(c.session_time, e.session_time) as session_time,
             case when c.id is not null then c.status
                  when public._clock() > e.closes_at then 'missed'
                  when public._clock() >= e.opens_at then 'open'
                  else 'upcoming' end as status,
             c.checked_in_at, round(c.distance_m::numeric) as distance_m, c.note,
             (select coalesce(o.full_name, o.username) from public.admins o where o.id = c.override_by) as override_by_name
        from expected e
        left join public.coach_attendance c on c.admin_id = e.admin_id and c.gym_date = e.gym_date
      union all
      -- Check-ins/overrides on days no longer (or never) in the schedule.
      select c.admin_id, coalesce(a.full_name, a.username), c.gym_date, c.session_time, c.status,
             c.checked_in_at, round(c.distance_m::numeric), c.note,
             (select coalesce(o.full_name, o.username) from public.admins o where o.id = c.override_by)
        from public.coach_attendance c
        join public.admins a on a.id = c.admin_id and a.tracks_attendance
       where c.gym_date between p_from and p_to
         and not exists (select 1 from expected e where e.admin_id = c.admin_id and e.gym_date = c.gym_date)
    )
    select jsonb_agg(jsonb_build_object(
             'admin_id', admin_id, 'full_name', full_name, 'gym_date', gym_date,
             'session_time', to_char(session_time, 'HH24:MI'), 'status', status,
             'checked_in_at', checked_in_at, 'distance_m', distance_m, 'note', note,
             'override_by_name', override_by_name
           ) order by gym_date desc, full_name)
      from report
  ), '[]'::jsonb);
end;
$$;

-- Mark a staff member present for a gym date (e.g. arrived late) with a note.
create or replace function public.coach_attendance_override(p_token text, p_admin_id uuid,
                                                            p_date date, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_by uuid := public._full_admin_for_token(p_token);
  v_time time;
begin
  if v_by is null then
    return jsonb_build_object('error', 'not_admin');
  end if;
  if p_date is null or p_date > public._gym_now()::date then
    return jsonb_build_object('error', 'invalid_date');
  end if;
  if coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('error', 'note_required');
  end if;
  if not exists (select 1 from public.admins where id = p_admin_id and tracks_attendance) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if exists (select 1 from public.coach_attendance where admin_id = p_admin_id and gym_date = p_date) then
    return jsonb_build_object('error', 'already_recorded');
  end if;

  select session_time into v_time from public.coach_schedule
   where admin_id = p_admin_id and weekday = extract(dow from p_date);

  insert into public.coach_attendance (admin_id, gym_date, session_time, status, checked_in_at, override_by, note)
  values (p_admin_id, p_date, v_time, 'override', public._clock(), v_by, trim(p_note));
  return jsonb_build_object('ok', true);
end;
$$;
