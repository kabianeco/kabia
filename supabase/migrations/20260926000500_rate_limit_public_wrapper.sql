-- ============================================================================
-- S7 (rate limiter wiring): public SECURITY DEFINER wrapper delegating to
-- private.consume_auth_rate_limit.
--
-- WHAT: public.consume_auth_rate_limit with the IDENTICAL signature delegates
-- to private.consume_auth_rate_limit and returns its jsonb untouched. EXECUTE
-- granted to service_role only (plus postgres as owner); explicitly revoked
-- from public, anon and authenticated. The private function keeps its grants.
--
-- WHY A WRAPPER (not .schema("private") at the call site): zero client
-- change — the existing supabase.rpc("consume_auth_rate_limit", ...) call in
-- lib/auth/rate-limit.ts resolves against the public schema, so deployed
-- production code starts being limited without a redeploy. The private
-- function remains the single implementation; the wrapper is a one-line
-- delegate a reviewer can verify at a glance.
--
-- SECOND FINDING (fixed here): the private function itself could never deny.
-- It inserted window_start = now() per call, so the ON CONFLICT
-- (bucket, dimension, window, key, window_start) never matched and every
-- count stayed 1 (verified live: three rapid calls all returned count = 1).
-- Fixed below by truncating the window start to a fixed
-- floor(now / window_secs) boundary, so calls inside one window share a row
-- and the count actually accumulates. Verified live post-fix: counts 1,2,3
-- with allowed true,true,false at max 2.
-- ROLLBACK: drop function public.consume_auth_rate_limit(text,text,text,text,integer,integer);
-- (limiter calls fail with PGRST202 again — the pre-fix fail-open state).
--
-- BACKWARD COMPATIBILITY: purely additive — no public function of this name
-- existed (verified live 2026-09-26). No caller behavior changes except that
-- the previously-always-erroring RPC now succeeds, which is the fix.
-- ============================================================================

-- Fixed-window private implementation (see SECOND FINDING note above).
create or replace function private.consume_auth_rate_limit(
  p_bucket_kind text,
  p_dimension text,
  p_window_kind text,
  p_key_hash text,
  p_window_secs integer,
  p_max_count integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'private', 'pg_temp'
as $function$
declare
  v_now          timestamptz := now();
  v_window_start timestamptz;
  v_window_end   timestamptz;
  v_count        integer;
  v_allowed      boolean;
begin
  if length(p_key_hash) > 64 or length(p_key_hash) < 8 then
    raise exception 'Invalid key hash length' using errcode = '22023';
  end if;
  if p_window_secs is null or p_window_secs < 1 then
    raise exception 'Invalid window' using errcode = '22023';
  end if;
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_secs) * p_window_secs
  );
  v_window_end := v_window_start + (p_window_secs || ' seconds')::interval;
  delete from private.auth_rate_limit_buckets
    where bucket_kind = p_bucket_kind
      and dimension = p_dimension
      and window_kind = p_window_kind
      and key_hash = p_key_hash
      and window_end < v_now;
  insert into private.auth_rate_limit_buckets (bucket_kind, dimension, window_kind, key_hash, window_start, window_end, count, last_seen)
  values (p_bucket_kind, p_dimension, p_window_kind, p_key_hash, v_window_start, v_window_end, 1, v_now)
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
$function$;

create or replace function public.consume_auth_rate_limit(
  p_bucket_kind text,
  p_dimension text,
  p_window_kind text,
  p_key_hash text,
  p_window_secs integer,
  p_max_count integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'private', 'pg_temp'
as $function$
begin
  return private.consume_auth_rate_limit(
    p_bucket_kind, p_dimension, p_window_kind,
    p_key_hash, p_window_secs, p_max_count
  );
end;
$function$;

revoke all on function
  public.consume_auth_rate_limit(text, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.consume_auth_rate_limit(text, text, text, text, integer, integer)
  to service_role;
