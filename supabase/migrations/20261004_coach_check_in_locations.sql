-- Staff can check in at either branch: 1st Settlement (the original spot) or
-- CFC, each with a 500 m radius. Each check-in records which branch it was at,
-- and coach_today / coach_attendance_report return it so the app can show it.
-- Safe to run twice.

-- Check-in spots. Locked down like the other coach tables (no browser
-- access), unlike public.branches which the anon key can still edit.
create table if not exists public.coach_check_in_locations (
  name text primary key,
  latitude double precision not null,
  longitude double precision not null,
  radius_m double precision not null default 500 check (radius_m > 0),
  active boolean not null default true
);

alter table public.coach_check_in_locations enable row level security;
revoke all on public.coach_check_in_locations from public, anon, authenticated;

-- 1st Settlement: 30°02'52.1"N 31°29'44.3"E   CFC: 30°02'02.6"N 31°24'14.9"E
insert into public.coach_check_in_locations (name, latitude, longitude, radius_m) values
  ('1st Settlement', 30.047806, 31.495639, 500),
  ('CFC',            30.034056, 31.404139, 500)
on conflict (name) do update
  set latitude = excluded.latitude, longitude = excluded.longitude, radius_m = excluded.radius_m;

alter table public.coach_attendance add column if not exists location_name text;

-- Every location check-in before this migration was at 1st Settlement.
update public.coach_attendance set location_name = '1st Settlement'
 where status = 'present' and location_name is null;

-- The branch whose circle contains the point, or failing that the nearest one.
create or replace function public._nearest_check_in_location(p_lat double precision, p_lng double precision,
                                                             out name text, out distance_m double precision,
                                                             out radius_m double precision)
language sql
stable
as $$
  select l.name, d.distance_m, l.radius_m
    from public.coach_check_in_locations l
    cross join lateral (select public._distance_m(l.latitude, l.longitude, p_lat, p_lng) as distance_m) d
   where l.active
   order by d.distance_m > l.radius_m, d.distance_m
   limit 1
$$;

revoke all on function public._nearest_check_in_location(double precision, double precision)
  from public, anon, authenticated;

-- Same as before, plus 'location' (where today's check-in was recorded).
create or replace function public.coach_today(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_admin uuid := public._admin_for_token(p_token);
  v_today date := public._gym_now()::date;
  v_time time;
  v_win record;
  v_att public.coach_attendance;
begin
  if v_admin is null then
    return jsonb_build_object('error', 'not_signed_in');
  end if;

  select session_time into v_time from public.coach_schedule
   where admin_id = v_admin and weekday = extract(dow from v_today);
  if v_time is null then
    return jsonb_build_object('scheduled', false);
  end if;

  select * into v_win from public._coach_window(v_today, v_time);
  select * into v_att from public.coach_attendance where admin_id = v_admin and gym_date = v_today;

  return jsonb_build_object(
    'scheduled', true,
    'session_time', to_char(v_time, 'HH24:MI'),
    'session_at', v_win.session_at,
    'opens_at', v_win.opens_at,
    'closes_at', v_win.closes_at,
    'now', public._clock(),
    'checked_in', v_att.id is not null,
    'checked_in_at', v_att.checked_in_at,
    'status', v_att.status,
    'location', v_att.location_name
  );
end;
$$;

-- Check in with the device's location. Returns {ok, checked_in_at, distance_m,
-- location} or {error: not_signed_in | not_scheduled | already_checked_in |
-- too_early | too_late | location_required | location_imprecise | too_far |
-- no_locations, ...details}. too_far carries the nearest branch and distance.
create or replace function public.coach_check_in(p_token text, p_lat double precision,
                                                 p_lng double precision, p_accuracy double precision)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin uuid := public._admin_for_token(p_token);
  v_today date := public._gym_now()::date;
  v_time time;
  v_win record;
  v_loc record;
  v_existing public.coach_attendance;
  v_row public.coach_attendance;
begin
  if v_admin is null then
    return jsonb_build_object('error', 'not_signed_in');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_admin::text, 43));

  select session_time into v_time from public.coach_schedule
   where admin_id = v_admin and weekday = extract(dow from v_today);
  if v_time is null then
    return jsonb_build_object('error', 'not_scheduled');
  end if;

  select * into v_existing from public.coach_attendance where admin_id = v_admin and gym_date = v_today;
  if v_existing.id is not null then
    return jsonb_build_object('error', 'already_checked_in', 'checked_in_at', v_existing.checked_in_at);
  end if;

  select * into v_win from public._coach_window(v_today, v_time);
  if public._clock() < v_win.opens_at then
    return jsonb_build_object('error', 'too_early', 'opens_at', v_win.opens_at, 'closes_at', v_win.closes_at);
  end if;
  if public._clock() > v_win.closes_at then
    return jsonb_build_object('error', 'too_late', 'closes_at', v_win.closes_at);
  end if;

  if p_lat is null or p_lng is null then
    return jsonb_build_object('error', 'location_required');
  end if;
  if p_accuracy is not null and p_accuracy > 1000 then
    return jsonb_build_object('error', 'location_imprecise', 'accuracy_m', round(p_accuracy::numeric));
  end if;

  select * into v_loc from public._nearest_check_in_location(p_lat, p_lng);
  if v_loc.name is null then
    return jsonb_build_object('error', 'no_locations');
  end if;
  if v_loc.distance_m > v_loc.radius_m then
    return jsonb_build_object('error', 'too_far', 'distance_m', round(v_loc.distance_m::numeric),
                              'location', v_loc.name, 'radius_m', round(v_loc.radius_m::numeric));
  end if;

  insert into public.coach_attendance
    (admin_id, gym_date, session_time, status, checked_in_at, latitude, longitude, accuracy_m, distance_m, location_name)
  values (v_admin, v_today, v_time, 'present', public._clock(), p_lat, p_lng, p_accuracy, v_loc.distance_m, v_loc.name)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'checked_in_at', v_row.checked_in_at,
                            'distance_m', round(v_loc.distance_m::numeric), 'location', v_loc.name);
end;
$$;

-- Same as 20260929_staff_attendance_flag.sql, plus 'location' on each row.
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
             c.checked_in_at, round(c.distance_m::numeric) as distance_m, c.location_name, c.note,
             (select coalesce(o.full_name, o.username) from public.admins o where o.id = c.override_by) as override_by_name
        from expected e
        left join public.coach_attendance c on c.admin_id = e.admin_id and c.gym_date = e.gym_date
      union all
      -- Check-ins/overrides on days no longer (or never) in the schedule.
      select c.admin_id, coalesce(a.full_name, a.username), c.gym_date, c.session_time, c.status,
             c.checked_in_at, round(c.distance_m::numeric), c.location_name, c.note,
             (select coalesce(o.full_name, o.username) from public.admins o where o.id = c.override_by)
        from public.coach_attendance c
        join public.admins a on a.id = c.admin_id and a.tracks_attendance
       where c.gym_date between p_from and p_to
         and not exists (select 1 from expected e where e.admin_id = c.admin_id and e.gym_date = c.gym_date)
    )
    select jsonb_agg(jsonb_build_object(
             'admin_id', admin_id, 'full_name', full_name, 'gym_date', gym_date,
             'session_time', to_char(session_time, 'HH24:MI'), 'status', status,
             'checked_in_at', checked_in_at, 'distance_m', distance_m, 'location', location_name,
             'note', note, 'override_by_name', override_by_name
           ) order by gym_date desc, full_name)
      from report
  ), '[]'::jsonb);
end;
$$;
