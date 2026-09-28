-- Coach roles and coach attendance (2026-09-28).
--
-- Staff accounts live in public.admins. This adds a role:
--   * 'admin' - full admin panel (baza, donia, bebo, ma7a/Sameh).
--   * 'coach' - only the Classes tab (mark athletes attended) plus their own
--               check-in (mesbah, farah, and a new khaled account).
-- Anyone with a weekly session time in coach_schedule must check in on those
-- days: from 60 minutes before the session until 10 minutes before it, once
-- per gym day, from within 500 m of the gym (30°02'52.1"N 31°29'44.3"E).
-- A coach who misses the window cannot check in; the day shows as missed and
-- an admin can mark them present with a note.
--
-- All rules are enforced here (security-definer RPCs keyed on the admin
-- session token); the browser only shows the results. Coach-tab limits are
-- enforced in the UI: the data tables themselves are still readable with the
-- public key until the app moves to per-user auth + RLS.
--
-- Depends on 20260926_server_side_pins.sql. Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

alter table public.admins add column if not exists role text not null default 'admin';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admins_role_check') then
    alter table public.admins add constraint admins_role_check check (role in ('admin', 'coach'));
  end if;
end $$;

update public.admins set role = 'coach' where lower(username) in ('mesbah', 'farah') and role <> 'coach';

-- New coach account. It cannot log in until the owner sets its PIN:
--   select public.set_admin_pin('khaled', '1234');
insert into public.admins (username, full_name, role)
select 'khaled', 'Khaled', 'coach'
 where not exists (select 1 from public.admins where lower(username) = 'khaled');

-- Browser roles may not create or delete staff accounts or change roles.
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
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_admin_writes on public.admins;
create trigger guard_admin_writes
  before insert or update or delete on public.admins
  for each row execute function public.guard_admin_writes();

-- Session JSON now carries the role.
create or replace function public._admin_json(p_admin public.admins)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_admin.id,
    'full_name', coalesce(p_admin.full_name, p_admin.username),
    'email', coalesce(p_admin.email, ''),
    'role', p_admin.role
  )
$$;

revoke all on function public._admin_json(public.admins) from public, anon, authenticated;

-- Returns {token, admin: {id, full_name, email, role}} or {error: invalid|locked}.
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
    'admin', public._admin_json(v_admin)
  );
end;
$$;

-- {id, full_name, email, role} for a live admin session, or null.
create or replace function public.admin_session(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public._admin_json(a)
    from public.admins a
   where a.id = public._admin_for_token(p_token)
$$;

-- Id of a live session's account if it has the 'admin' role, else null.
create or replace function public._full_admin_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select a.id from public.admins a
   where a.id = public._admin_for_token(p_token) and a.role = 'admin'
$$;

revoke all on function public._full_admin_for_token(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule and attendance tables (no browser access)
-- ---------------------------------------------------------------------------

-- One session time per staff member per weekday (0 = Sunday ... 6 = Saturday,
-- gym time). The check-in window is derived from session_time.
create table if not exists public.coach_schedule (
  admin_id uuid not null references public.admins (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  session_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (admin_id, weekday)
);

create table if not exists public.coach_attendance (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins (id) on delete cascade,
  gym_date date not null,
  session_time time,
  status text not null check (status in ('present', 'override')),
  checked_in_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  override_by uuid references public.admins (id) on delete set null,
  note text,
  unique (admin_id, gym_date)
);

alter table public.coach_schedule enable row level security;
alter table public.coach_attendance enable row level security;
revoke all on public.coach_schedule, public.coach_attendance from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

-- The one clock every coach rule reads (tests pin it to a fixed moment).
create or replace function public._clock()
returns timestamptz
language sql
stable
as $$ select now() $$;

create or replace function public._gym_now()
returns timestamp
language sql
stable
as $$ select public._clock() at time zone 'Africa/Cairo' $$;

-- Metres between two points (haversine).
create or replace function public._distance_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- The gym: 30°02'52.1"N 31°29'44.3"E.
create or replace function public._gym_distance_m(p_lat double precision, p_lng double precision)
returns double precision
language sql
immutable
as $$ select public._distance_m(30.047806, 31.495639, p_lat, p_lng) $$;

-- Check-in window for a session at p_time on gym date p_date.
create or replace function public._coach_window(p_date date, p_time time,
                                                out opens_at timestamptz, out closes_at timestamptz,
                                                out session_at timestamptz)
language sql
stable
as $$
  select ((p_date + p_time) at time zone 'Africa/Cairo') - interval '60 minutes',
         ((p_date + p_time) at time zone 'Africa/Cairo') - interval '10 minutes',
         ((p_date + p_time) at time zone 'Africa/Cairo')
$$;

revoke all on function public._clock(), public._gym_now(),
                       public._distance_m(double precision, double precision, double precision, double precision),
                       public._gym_distance_m(double precision, double precision),
                       public._coach_window(date, time)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs for every staff member
-- ---------------------------------------------------------------------------

-- Today's check-in state for the signed-in staff member:
-- {scheduled: false} or {scheduled, session_time, session_at, opens_at,
--  closes_at, now, checked_in, checked_in_at, status}.
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
    'status', v_att.status
  );
end;
$$;

-- Check in with the device's location. Returns {ok, checked_in_at, distance_m}
-- or {error: not_signed_in | not_scheduled | already_checked_in | too_early |
--  too_late | location_required | location_imprecise | too_far, ...details}.
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
  v_distance double precision;
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

  v_distance := public._gym_distance_m(p_lat, p_lng);
  if v_distance > 500 then
    return jsonb_build_object('error', 'too_far', 'distance_m', round(v_distance::numeric));
  end if;

  insert into public.coach_attendance
    (admin_id, gym_date, session_time, status, checked_in_at, latitude, longitude, accuracy_m, distance_m)
  values (v_admin, v_today, v_time, 'present', public._clock(), p_lat, p_lng, p_accuracy, v_distance)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'checked_in_at', v_row.checked_in_at,
                            'distance_m', round(v_distance::numeric));
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin-only RPCs
-- ---------------------------------------------------------------------------

-- Staff list with each person's weekly session times:
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
  if not exists (select 1 from public.admins where id = p_admin_id) then
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

-- Attendance for every scheduled day in [p_from, p_to] (gym dates, max 63):
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
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
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
  if not exists (select 1 from public.admins where id = p_admin_id) then
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

revoke all on function
  public.coach_today(text),
  public.coach_check_in(text, double precision, double precision, double precision),
  public.coach_schedule_list(text),
  public.coach_schedule_set(text, uuid, smallint, time),
  public.coach_attendance_report(text, date, date),
  public.coach_attendance_override(text, uuid, date, text)
  from public, anon, authenticated;

grant execute on function
  public.coach_today(text),
  public.coach_check_in(text, double precision, double precision, double precision),
  public.coach_schedule_list(text),
  public.coach_schedule_set(text, uuid, smallint, time),
  public.coach_attendance_report(text, date, date),
  public.coach_attendance_override(text, uuid, date, text)
  to anon, authenticated;
