# Supabase Auth + Row-Level Security — Design Spec

**Date:** 2026-09-29
**Status:** Draft — all decisions made (§8); ready for phase 1
**Repo:** `7pka111223-jpg/T1Transfer` (gym webapp, Vite + React, Vercel, Supabase)

## 1. Problem

Every request from the app uses the one public anon key, so the database cannot tell a member from an admin from a stranger. Since 2026-09-26 the PINs, login sessions and coach attendance are locked behind server functions, but every other table (members' phones and medical notes, subscriptions, payments, bookings, attendance) can still be read and changed by anyone holding the public key, which ships in the site's JavaScript.

## 2. Goal

Every request carries who is asking, and the database decides per row what that person may read or change. Login screens and the PIN experience stay the same for members and staff.

## 3. Approach

- **Real Supabase logins behind the existing PIN screens.** A Supabase Edge Function (`pin-login`) checks the member ID or staff username plus PIN against the existing bcrypt hashes (`member_credentials`, `admin_credentials`), then returns a real Supabase Auth session. The client stores it with `supabase.auth.setSession`, and supabase-js renews it automatically. No emails or passwords for users.
  - Planned mechanism: `auth.admin.generateLink({ type: 'magiclink' })` + server-side `verifyOtp` to mint the session without a user password. **Verify this first on the project's plan (spike in phase 1).** Fallback: set a random per-login password with the admin API and `signInWithPassword` server-side.
- **One Auth user per person.** A script (service role, run once) creates an Auth user for each of the 118 members and 7 staff, using synthetic identifiers (e.g. `t1001@members.tripleonebars.invalid`). A link table `app_users(auth_user_id, member_id | admin_id, role)` maps each one to its record. The role (`member`, `coach`, `admin`) is set in **`app_metadata`** (never `user_metadata`, see §3.1) so policies can read it from the JWT, with `app_metadata.app = 'gym'`.

### 3.1 Shared Auth with the coaching app (confirmed 2026-09-29)

The coaching app (coach.tripleonebars.com; Vercel project `tripleonebars`; repo `7pka111223-jpg/tripleonebars`) runs on **this same Supabase project** (`wfpduvriaihqnpczggxm`). Its live `NEXT_PUBLIC_SUPABASE_URL` points here; the `bpltbnlpkuebhxgbbxrk` URL in its repo scripts is stale. It:

- already uses **Supabase Auth** (`signInWithPassword`; server actions call `auth.admin.*` with the service role key);
- owns its own tables (`profiles`, `athletes`, `registrations`, `exercises`, `workout_templates`, `template_exercises`, `template_routines`, `assignments`, `assignment_items`, `subscriptions`, `activity_events`, `note_dismissals`) with RLS already on (`my_role()` over `profiles.role`: `owner` / `coach` / `athlete`);
- does **not** read or write any gym-webapp table.

Consequences for this plan:

- **Its `after insert on auth.users` trigger creates a `profiles` row for every new Auth user**, with `role = coalesce((raw_user_meta_data->>'role')::app_role, 'athlete')`. Creating gym users naively would add 125 fake athletes to the coaching app, and any non-enum `user_metadata.role` (e.g. `member`) would make the cast, and so the user creation, fail.
- **Required before phase 2:** a migration in the coaching repo changing that trigger to skip users with `raw_app_meta_data->>'app' = 'gym'` (or whatever Q4 decides), shipped and tested first.
- **Phase 4 does not affect the coaching app's own tables**; its server-side service-role queries bypass RLS anyway. Keep its tables and policies out of this migration.
- **Two apps now share `auth.users`.** Q4 decides whether a person has one login across both apps or separate ones.
- **Row-level security on every table**, using `auth.uid()` and the role from the JWT, per the matrix in §4. The anon role keeps only what the public pages need.
- **Activation** (member sets a PIN) moves into the same Edge Function, so a member's Auth user is created or confirmed when they activate.

## 4. Access matrix

Derived from the current code's table usage (inventory taken 2026-09-29).

| Data | Members | Coaches | Admins | Public (anon) |
|---|---|---|---|---|
| `branches`, `group_classes`, `subscription_packages`, `class_sessions`, `movements` | read | read | full | read `branches`, `group_classes` (landing, booking) |
| `assessment_sessions` | — | — | full | insert only (booking form) |
| `members` | own row; limited self-edit | name, member_id, level, phone (via a roster view) | full | — |
| `member_subscriptions`, `shared_subscriptions`, `shared_subscription_members`, `session_deductions`, `manual_payments` | own, read only | — | full | — |
| `class_bookings` | own: read, book, cancel | read; mark attended | full | — |
| `attendance_records` | own, read only (writes via RPC) | insert for session rosters | full | — |
| `personal_records` | own: read, insert | — | full | — |
| `body_metrics` | own, read | — | full | — |
| `admins`, coach tables, credentials, sessions | — | own staff record | full | — |

Realtime (`attendance-changes` channel in the admin dashboard) respects RLS, so it keeps working for admins.

## 5. Phases

Each phase ships separately and can be rolled back on its own.

1. **Preparation.**
   - Stand up a test copy of the database (§8 Q2), **including the coaching app's schema and auth trigger**, so both apps are tested together.
   - Ship the coaching-repo trigger change (§3.1) and confirm on the test copy that creating a gym Auth user adds no coaching profile.
   - Build an RLS test harness that runs as each role (anon, member, coach, admin) and checks allowed and refused operations. Locally via PGlite with a stub `auth` schema; against the test project for integration.
   - Spike the Edge Function session minting (§3).
2. **Real logins, no behaviour change.**
   - Create the Auth users and the `app_users` links.
   - Switch member login, activation and staff login to `pin-login`; the client sends the user's JWT with every request.
   - Keep the existing token RPCs (`member_session`, `admin_session`, `coach_*`) working in parallel.
   - Everyone logs in once more.
3. **Move trusted actions server-side.**
   - `qr_check_in`, `coach_*` and any other RPC that takes an identity derive it from `auth.uid()`, not from a member id or token sent by the phone. Today anyone can call `qr_check_in` with any member id.
   - Replace the member app's direct writes with RPCs:
     - the `member_subscriptions` / `shared_subscriptions` / `session_deductions` fallback when `deduct_session_for_attendance` fails;
     - `attendance_records` inserts from the class check-in buttons.
4. **Enable RLS table by table**, in small batches: public reference tables, then member-owned tables, then staff-only tables.
   - For each batch: add the policies, enable RLS, revoke anon grants, deploy.
   - Run the smoke test in all four roles, then watch it for a day.
   - Rollback for a table: `alter table … disable row level security`.
5. **Clean-up.**
   - Drop `member_sessions` and `admin_sessions`, and the token parameters on RPCs.
   - Drop the emptied plaintext `pin` columns (after confirming nothing reads them, §8 Q1).
   - Update this spec and `CONTEXT.md`.

Estimated effort: roughly 8–12 working sessions over a few weeks, letting each phase settle before the next.

## 6. Verification

- Per phase: `npm run check` (typecheck, build, headless smoke test), extended with a role matrix: each screen as anon, member, coach and admin, plus direct API calls that must be refused.
- RLS harness results for every table in §4 before its batch ships.
- After each deploy: log in on the live site as a member, a coach and an admin.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Gym Auth users leak into the coaching app as athletes (shared `auth.users` trigger) | Coaching-repo trigger skips `app_metadata.app = 'gym'` (§3.1), shipped and tested before phase 2 |
| Coaching app regresses from gym changes | Test copy includes both schemas; smoke-test coach.tripleonebars.com login after each phase |
| Phones running a cached old version of the app | Phase 2 forces one re-login; old tokens stay valid until phase 5 |
| A policy hides data someone needs | Role-matrix tests; one table per batch; instant per-table rollback |
| Edge Function session minting not supported as planned | Spike in phase 1; password-based fallback in §3 |
| Service role key exposure | Lives only in Edge Function secrets; never in `VITE_` variables or the client |

## 8. Decisions

Answered 2026-09-29:

1. **Coaching app on this database?** Yes, confirmed: its live Vercel config points at `wfpduvriaihqnpczggxm`. It uses Supabase Auth and its own tables only (§3.1).
2. **Test copy:** a second free Supabase project. Note the free plan allows two active projects per organisation; the stale `bpltbnlpkuebhxgbbxrk` project may need pausing or deleting to make room (check it holds nothing needed first).
3. **Coaches see members' phone numbers:** yes. The coach roster view includes `phone` (§4).

4. **One login across both apps, or separate?** Separate. Gym users are flagged `app_metadata.app = 'gym'` and skipped by the coaching app's auth trigger (§3.1); a person who uses both apps keeps two logins. Unifying accounts is a possible later project.

## 9. Out of scope

- Changing the PIN login experience (no email or password for users).
- The member app's visual design and features.
- The coaching app itself, beyond the auth-trigger change in §3.1 (and account linking, if Q4 is later decided that way).
