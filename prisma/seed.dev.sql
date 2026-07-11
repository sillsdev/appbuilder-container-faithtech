-- DEVELOPMENT ONLY — do not apply to staging or production.
--
-- Inserts a ready-to-use administrator so the admin UI can be logged into
-- without going through /setup. This ships a KNOWN password hash, which is
-- acceptable only for local development. The `db:seed:dev` script applies it
-- with `--local` and there is intentionally no remote variant.
--
--   email:    admin@example.invalid
--   password: demo-password-123
--
-- Upserts by email so it also upgrades the unusable placeholder from seed.sql
-- into a working account if that seed was applied first.

INSERT INTO "administrators" (
  "id",
  "email",
  "display_name",
  "password_hash",
  "disabled",
  "created_at",
  "updated_at"
) VALUES (
  'usr-dev-admin',
  'admin@example.invalid',
  'Dev Administrator',
  'pbkdf2$100000$n8WLsEWz9upL3x6Neo89rQ==$/Nd3YFid9U81j57iK5QGM2hPpiVSsQRL3SVByy4WTrU=',
  0,
  '2026-07-11T00:00:00.000Z',
  '2026-07-11T00:00:00.000Z'
)
ON CONFLICT("email") DO UPDATE SET
  "password_hash" = excluded."password_hash",
  "display_name"  = excluded."display_name",
  "disabled"      = 0,
  "updated_at"    = excluded."updated_at";
