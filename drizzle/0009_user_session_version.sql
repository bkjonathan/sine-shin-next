-- Session revocation (AUDIT.md F-06). Each session JWT carries the user's
-- session_version from sign-in, and auth() rejects a token whose version no
-- longer matches the row. Incrementing it (role change, password change) ends
-- every session that user has, immediately. Additive with a constant default,
-- so on Postgres 11+ this is a metadata-only change (no table rewrite).
-- IF NOT EXISTS so it is safe to run by hand before deploying the code that
-- reads it (the app cannot sign anyone in until this column exists).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
