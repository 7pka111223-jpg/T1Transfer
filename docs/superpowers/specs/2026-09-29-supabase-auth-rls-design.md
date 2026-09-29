# Supabase Auth + Row-Level Security — Design Spec

**Date:** 2026-09-29
**Status:** Draft — waiting on the open questions in §8
**Repo:** `7pka111223-jpg/T1Transfer` (gym webapp, Vite + React, Vercel, Supabase)

## 1. Problem

Every request from the app uses the one public anon key, so the database cannot tell a member from an admin from a stranger. Since 2026-09-26 the PINs, login sessions and coach attendance are locked behind server functions, but every other table (members' phones and medical notes, subscriptions, payments, bookings, attendance) can still be read and changed by anyone holding the public key, which ships in the site's JavaScript.

## 2. Goal

Every request carries who is asking, and the database decides per row what that person may read or change. Login screens and the PIN experience stay the same for members and staff.

## 3. Approach

- **Real Supabase logins behind the existing PIN screens.** A Supabase Edge Function (`pin-login`) checks the member ID or staff username plus PIN against the existing bcrypt hashes (`member_credentials`, `admin_credentials`), then returns a real Supabase Auth session. The client stores it with `supabase.auth.setSession`, and supabase-js renews it automatically. No emails or passwords for users.
  - Planned mechanism: `auth.admin.generateLink({ type: 'magiclink' })` + server-side `verifyOtp` to mint the session without a user password. **Verify this first on the project's plan (spike in phase 1).** Fallback: set a random per-login password with the admin API and `signInWithPassword` server-side.
- **One Auth user per person.** A script (service role, run once) creates an Auth user for each of the 118 members and 7 staff, using synthetic identifiers (e.g. `t1001@members.tripleonebars.invalid`). A link table `app_users(auth_user_id, member_id | admin_id, role)` maps each one to its record. The role (`member`, `coach`, `admin`) is also set in `app_metadata` so policies can read it from the JWT.
- **Row-level security on every table**, using `auth.uid()` and the role from the JWT, per the matrix in §4. The anon role keeps only what the public pages need.
- **Activation** (member sets a PIN) moves into the same Edge Function, so a member's Auth user is created or confirmed when they activate.

## 4. Access matrix

Derived from the current code's table usage (inventory taken 2026-09-29).

| Data | Members | Coaches | Admins | Public (anon) |
|---|---|---|---|---|
| `branches`, `group_classes`, `subscription_packages`, `class_sessions`, `movements` | read | read | full | read `branches`, `group_classes` (landing, booking) |
| `assessment_sessions` | — | — | full | insert only (booking form) |
| `members` | own row; limited self-edit | name, member_id, level (via a roster view) | full | — |
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
   - Stand up a test copy of the database (§8 Q2).
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
| Another app on this database (e.g. the coaching app) breaks when anon access is revoked | Answer §8 Q1 before phase 4; migrate that app to the same login first |
| Phones running a cached old version of the app | Phase 2 forces one re-login; old tokens stay valid until phase 5 |
| A policy hides data someone needs | Role-matrix tests; one table per batch; instant per-table rollback |
| Edge Function session minting not supported as planned | Spike in phase 1; password-based fallback in §3 |
| Service role key exposure | Lives only in Edge Function secrets; never in `VITE_` variables or the client |

## 8. Open questions (block phase 1)

1. Does the coaching app (coach.tripleonebars.com) use this same Supabase database? If so, it must move to the new logins before phase 4.
2. Test copy: a second free Supabase project, or Supabase branching (paid)?
3. Should coaches see members' phone numbers? Current plan: names, IDs and levels only.

## 9. Out of scope

- Changing the PIN login experience (no email or password for users).
- The member app's visual design and features.
- The coaching app itself, beyond moving it to the new logins if Q1 is yes.
