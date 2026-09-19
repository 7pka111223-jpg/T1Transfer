-- Lead conversion tracking for assessment bookings.
-- Self-sufficient baseline: the assessment_sessions table was originally created
-- via the Supabase dashboard and never committed as a migration, so fresh or
-- re-linked projects fail with 42P01 (undefined table). This file creates the
-- full table (columns reconstructed from src/components/AssessmentBooking.tsx
-- and src/components/AdminDashboard.tsx usage) and then adds lead_status.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  branch text,
  preferred_date date,
  preferred_time text,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  confirmed boolean not null default false,
  archived boolean not null default false,
  lead_status text not null default 'not_contacted'
);

-- Backfill any legacy NULLs (e.g. rows written before defaults existed).
update public.assessment_sessions
  set lead_status = 'not_contacted'
  where lead_status is null;

-- Constrain to the admin workflow states.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assessment_sessions_lead_status_check'
  ) then
    alter table public.assessment_sessions
      add constraint assessment_sessions_lead_status_check
      check (lead_status in ('not_contacted', 'contacted', 'no_answer', 'booked'));
  end if;
end
$$;

-- The web app uses the anon key directly (select/insert/update), so the table
-- needs RLS policies permitting exactly those operations.
alter table public.assessment_sessions enable row level security;

drop policy if exists assessment_sessions_select on public.assessment_sessions;
create policy assessment_sessions_select on public.assessment_sessions
  for select to anon, authenticated using (true);

drop policy if exists assessment_sessions_insert on public.assessment_sessions;
create policy assessment_sessions_insert on public.assessment_sessions
  for insert to anon, authenticated with check (true);

drop policy if exists assessment_sessions_update on public.assessment_sessions;
create policy assessment_sessions_update on public.assessment_sessions
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.assessment_sessions to anon, authenticated;

create index if not exists assessment_sessions_lead_status_idx
  on public.assessment_sessions (lead_status);

create index if not exists assessment_sessions_created_at_idx
  on public.assessment_sessions (created_at desc);

create index if not exists assessment_sessions_status_idx
  on public.assessment_sessions (status) where archived = false;
