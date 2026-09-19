# Webapp Persistent Login — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Repo:** `7pka111223-jpg/T1Transfer` (gym webapp, Vite + React, Hostinger-hosted)

## Overview

Members and admins currently sign in with a phone/PIN on every app open because the session lives only in React state. This change persists the session in `localStorage` so reopening the app lands the user straight in their dashboard. Logins keep working exactly as today; logout signs out fully.

**Decisions (owner-approved 2026-09-19):** applies to **both** member and admin logins; approach is a `localStorage` session id plus re-fetch on boot (no Supabase Auth migration); always remembered, no opt-in toggle; no expiry; Logout clears the session.

## 1. Session store

- The pre-existing keys `t1_member` / `t1_admin` hold the login snapshot object; `t1_view` holds the last view. No new keys were introduced.
- The member snapshot is sanitized at login: all `MemberData` fields **except `pin`**. The admin snapshot never contained secrets (`{id, full_name, email}` only).
- Never stored: PIN. (Snapshots written before this change may still contain a member PIN until the next login overwrites them; nothing reads it.)

## 2. Boot restore (in `App.tsx`)

The existing synchronous restore from `t1_member` / `t1_admin` / `t1_view` is unchanged, followed by a new validation effect:
- For each stored session, fetch its row by id (`members` → `id,status`; `admins` → `id`). Missing row, member `status === 'pending'`, or malformed id → delete that key and clear the matching state.
- Transport failure → snapshot kept untouched for retry on next open.
- Afterwards (unless a QR check-in payload is pending, which owns the view): no sessions left → clear `t1_view` and show landing; exactly one side left → its dashboard; both kept → view untouched.

At most two lightweight queries per app open. A deleted or deactivated account can never boot into a broken dashboard.

## 3. Login / logout changes

- `MemberLogin` passes an explicit PIN-free snapshot to `onLogin` (every `MemberData` field except `pin`); persistence flows through the existing state→`localStorage` effects unchanged.
- Both Logout paths already deleted all three keys — unchanged.
- No other login, routing, or dashboard logic changes.

## 4. Edge cases

- Tampered or garbage key → caught on parse, cleared, landing shown.
- `localStorage` unavailable (rare private-mode edge) → silently fall back to today's behavior (login every open). No error UI.
- Shared computer → the last session stays signed in until someone presses Logout. Accepted tradeoff of persisting both roles (owner decision).
- Stored id is a plain UUID, readable by page JavaScript — acceptable: the app already ships a public anon key and checks plaintext PINs, so this adds no meaningful new exposure. The PIN itself is never persisted.

## 5. Verification and ship

- `npm run build` passes (project standard; no test framework exists in this repo).
- Manual matrix on a local build: member login → close tab → reopen lands in member dashboard; admin login → same for admin panel; Logout → reopen shows landing; delete or deactivate a member in Supabase → reopen falls back to landing; corrupted `t1_session` value → landing.
- Ship: rebuild `dist/` and upload to Hostinger (manual step — GitHub pushes do not deploy this app). Confirm the live site then holds the session across a tab close for both roles.

## 6. Out of scope

- Migrating the webapp to Supabase Auth (tokens, refresh, RLS) — rejected as overkill for this need.
- "Remember me" toggle, session expiry, or multi-device session management.
- Storing the PIN or any profile data client-side.
- Changes to the coaching app.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Stale session after account deletion/deactivation | Boot re-fetch validates; missing/inactive → key cleared, landing shown |
| Shared-device session carryover | Logout clears the key; accepted by owner decision |
| Key tampering | Parse wrapped in try/catch; any failure → cleared, landing shown |
| Login screens moved since last review (new `AuthPage`/`MemberApp` files exist) | Implementation plan must locate every actual login-submit and logout handler in the current tree before editing |
