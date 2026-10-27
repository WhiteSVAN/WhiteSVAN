-- Admin portal access for the founder's account (27 Oct 2026, at the founder's request), since
-- production can't be reached from a developer machine to run `npm run db:admin -- grant`.
-- The repository is public, so the email is matched by the SHA-256 of its trimmed, lowercased form
-- rather than written here. Only an existing account changes; grant or revoke anyone else with
-- `npm run db:admin`.
UPDATE "User"
SET "isAdmin" = true
WHERE encode(sha256(convert_to(lower(trim("email")), 'UTF8')), 'hex') = '5002cc04069f46a0e6e04b401fdf10aa290c4819f638deb4fa4dbbbb5650c2fc';
