-- Staff check-in now closes 5 minutes before the session instead of 10.
-- It still opens 60 minutes before. Everything that decides the window
-- (coach_today, coach_check_in, coach_attendance_report) reads this one
-- function, so redefining it is the whole change. Safe to run twice.

create or replace function public._coach_window(p_date date, p_time time,
                                                out opens_at timestamptz, out closes_at timestamptz,
                                                out session_at timestamptz)
language sql
stable
as $$
  select ((p_date + p_time) at time zone 'Africa/Cairo') - interval '60 minutes',
         ((p_date + p_time) at time zone 'Africa/Cairo') - interval '5 minutes',
         ((p_date + p_time) at time zone 'Africa/Cairo')
$$;

revoke all on function public._coach_window(date, time) from public, anon, authenticated;
