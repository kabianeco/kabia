-- ---------------------------------------------------------------------------
-- SEC-05: Distributed authentication rate limiting.
--
-- Private schema, Postgres-backed rate limiter suitable for Vercel serverless.
-- The table is in a private schema (not exposed through PostgREST), RLS is
-- enabled, and no role except service_role can read or call the consume
-- function. The application calls this via the service-role client from
-- server-only code.
--
-- Identifiers (email / username) and IP addresses are NEVER stored raw.
-- They are SHA-256 hashed with a server-side secret before insertion.
-- The secret is passed as a function parameter by the application; it is
-- never stored in the database.
--
-- Buckets are keyed by:
--   bucket_kind  — 'admin_login' | 'customer_login' | 'registration' | 'password_reset'
--   dimension    — 'ip' | 'identifier' | 'ip_identifier'
--   window_kind  — 'burst' | 'sustained'
--   key_hash     — SHA-256(dimension_value + salt)
--
-- Each row tracks a fixed time window. The consume function does an atomic
-- INSERT ... ON CONFLICT increment under a row lock, returns whether the
-- request is allowed, and the cleanup function purges expired rows.
-- ---------------------------------------------------------------------------

create schema if not exists private;

-- The rate-limit bucket table.
create table if not exists private.auth_rate_limit_buckets (
  bucket_kind   text not null,
  dimension     text not null check (dimension in ('ip', 'identifier', 'ip_identifier')),
  window_kind   text not null check (window_kind in ('burst', 'sustained')),
  key_hash      text not null,
  window_start  timestamptz not null,
  window_end    timestamptz not null,
  count         integer not null default 1,
  last_seen     timestamptz not null default now(),
  primary key (bucket_kind, dimension, window_kind, key_hash, window_start)
);

-- RLS: nobody but service_role (which bypasses RLS) should touch this.
alter table private.auth_rate_limit_buckets enable row level security;
-- No policies: anon and authenticated get nothing.

revoke all on schema private from public, anon, authenticated;
revoke all on table private.auth_rate_limit_buckets from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on table private.auth_rate_limit_buckets to service_role;

-- ---------------------------------------------------------------------------
-- Atomic consume function.
-- Called from server-only application code via the service-role client.
--
-- Parameters:
--   p_bucket_kind — 'admin_login' | 'customer_login' | 'registration' | 'password_reset'
--   p_dimension   — 'ip' | 'identifier' | 'ip_identifier'
--   p_window_kind — 'burst' | 'sustained'
--   p_key_hash    — SHA-256(dimension_value + salt), hex-encoded, ≤ 64 chars
--   p_window_secs — length of this window in seconds
--   p_max_count  — maximum requests allowed in this window
--
-- Returns jsonb with:
--   allowed     — true if this request is within the limit
--   count       — current count after this attempt
--   max_count   — the limit
--   retry_after — seconds until the window resets (0 if allowed)
-- ---------------------------------------------------------------------------

create or replace function private.consume_auth_rate_limit(
  p_bucket_kind text,
  p_dimension   text,
  p_window_kind text,
  p_key_hash    text,
  p_window_secs integer,
  p_max_count   integer
)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  v_now       timestamptz := now();
  v_window_end timestamptz := v_now + (p_window_secs || ' seconds')::interval;
  v_count     integer;
  v_allowed   boolean;
begin
  -- Bound key_hash length to prevent abuse.
  if length(p_key_hash) > 64 or length(p_key_hash) < 8 then
    raise exception 'Invalid key hash length' using errcode = '22023';
  end if;

  -- Atomic insert-or-increment under the primary key.
  -- ON CONFLICT locks the existing row, increments count, and bumps last_seen.
  -- If the window has expired (window_end < now), start a fresh row.
  delete from private.auth_rate_limit_buckets
    where bucket_kind = p_bucket_kind
      and dimension = p_dimension
      and window_kind = p_window_kind
      and key_hash = p_key_hash
      and window_end < v_now;

  insert into private.auth_rate_limit_buckets (bucket_kind, dimension, window_kind, key_hash, window_start, window_end, count, last_seen)
  values (p_bucket_kind, p_dimension, p_window_kind, p_key_hash, v_now, v_window_end, 1, v_now)
  on conflict (bucket_kind, dimension, window_kind, key_hash, window_start)
  do update set
    count = private.auth_rate_limit_buckets.count + 1,
    last_seen = v_now
  returning count into v_count;

  v_allowed := v_count <= p_max_count;

  return jsonb_build_object(
    'allowed', v_allowed,
    'count', v_count,
    'max_count', p_max_count,
    'retry_after', case when not v_allowed then p_window_secs else 0 end
  );
end;
$$;

revoke execute on function private.consume_auth_rate_limit(text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function private.consume_auth_rate_limit(text, text, text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Cleanup function: purge expired buckets. Called periodically by a cron
-- or application scheduled job.
-- ---------------------------------------------------------------------------

create or replace function private.cleanup_auth_rate_limit_buckets()
returns integer
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from private.auth_rate_limit_buckets
  where window_end < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function private.cleanup_auth_rate_limit_buckets() from public, anon, authenticated;
grant execute on function private.cleanup_auth_rate_limit_buckets() to service_role;