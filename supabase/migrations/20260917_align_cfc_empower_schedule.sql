-- Align the CFC branch's EMPOWER program with its published schedule:
-- Saturday, Monday and Wednesday only, 19:30-20:30.
--
-- The recurring rows in group_classes already drive the member app's Classes
-- tab, but the pre-generated rows in class_sessions (which the admin
-- "Classes & Rosters" view reads) still carry older times. This migration makes
-- the generated sessions match the class definition. Idempotent: safe to re-run.

-- 1. Lock the recurring definition to Mon (1), Wed (3), Sat (6), 19:30-20:30.
update public.group_classes gc
set start_time = time '19:30',
    end_time = time '20:30',
    is_active = true
from public.branches b
where gc.branch_id = b.id
  and lower(b.name) = 'cfc'
  and lower(gc.name) = 'empower'
  and gc.day_of_week in (1, 3, 6);

-- 2. An EMPOWER class on any other weekday is not part of the schedule.
update public.group_classes gc
set is_active = false
from public.branches b
where gc.branch_id = b.id
  and lower(b.name) = 'cfc'
  and lower(gc.name) = 'empower'
  and gc.day_of_week not in (1, 3, 6);

-- 3. Bring every existing session for those classes back in line with the
--    definition so the admin view and printed schedules agree.
update public.class_sessions cs
set start_time = time '19:30',
    end_time = time '20:30'
from public.group_classes gc
join public.branches b on b.id = gc.branch_id
where cs.group_class_id = gc.id
  and lower(b.name) = 'cfc'
  and lower(gc.name) = 'empower'
  and (cs.start_time is distinct from time '19:30'
       or cs.end_time is distinct from time '20:30');
