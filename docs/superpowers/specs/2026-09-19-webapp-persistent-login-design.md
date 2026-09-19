# Webapp Persistent Login — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Repo:** `7pka111223-jpg/T1Transfer` (gym webapp, Vite + React, Hostinger-hosted)

## Overview

Members and admins currently sign in with a phone/PIN on every app open because the session lives only in React state. This change persists the session in `localStorage` so reopening the app lands the user straight in their dashboard. Logins keep working exactly as today; logout signs out fully.

**Decisions (owner-approved 2026-09-19):** applies to **both** member and admin logins; approach is a `localStorage` session id plus re-fetch on boot (no Supabase Auth migration); always remembered, no opt-in toggle; no expiry; Logout clears the session.

## 1. Session store

- One `localStorage` key: `t1_session`.
- Value: JSON `{type: "member" | "admin", id: "<uuid>"}` — the row id in the table that login queries.
- Never stored: PIN, phone, names, or any personal data.

## 2. Boot restore (in `App.tsx`)

On mount, read `t1_session`:
- Absent or unparseable → landing page, exactly as today.
- Present → fetch that row from the same table the login uses. If found (and not deactivated, where the schema has such a flag) → render the member/admin dashboard directly. If the row is missing or deactivated → delete the key, show landing.

One query per app open. A deleted or deactivated account can never boot into a broken dashboard.

## 3. Login / logout changes

- After a successful PIN check (member login, admin login — whichever screens perform them, including any newer `AuthPage`/`MemberApp` entry points if they own a login), write `t1_session` before navigating to the dashboard.
- Both Logout paths (member dashboard, admin header) delete `t1_session` first, then navigate to landing as today.
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
