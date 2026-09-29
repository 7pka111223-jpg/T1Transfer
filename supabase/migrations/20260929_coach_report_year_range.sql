-- Let the coach attendance report cover up to a year, for CSV exports
-- (e.g. 2026-09-01 to 2026-10-01). Same function as in
-- 20260928_coach_attendance.sql; only the range cap changes (was ~2 months).
--
-- Idempotent: safe to re-run.

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
        join public.admins a on a.id = s.admin_id
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
        join public.admins a on a.id = c.admin_id
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
