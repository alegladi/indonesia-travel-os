-- Alegladi Brain security hardening reference.
-- Apply only as database owner and test on a branch first.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON DATABASE brain FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE brain FROM PUBLIC;

-- Runtime application role must be a native PostgreSQL role with:
-- NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
-- and must NOT be a member of neon_superuser.
-- Grant only CONNECT + schema USAGE + DML on required Brain tables/sequences.

-- Important: roles created by Neon management APIs may inherit neon_superuser.
-- Verify with pg_roles + pg_auth_members before using any role in DATABASE_URL.
