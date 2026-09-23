-- One member id per member.
--
-- generateMemberId() scans for a free T1xxx id, but without a unique constraint
-- two admins converting a lead at the same moment could insert the same id. This
-- makes the database the authority; the client retries with a fresh id on
-- conflict (23505).
--
-- Idempotent: safe to re-run. Verified there are no duplicate member_id values.

create unique index if not exists members_member_id_key on public.members (member_id);
