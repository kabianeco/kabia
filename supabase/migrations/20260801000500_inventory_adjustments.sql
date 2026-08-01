-- ---------------------------------------------------------------------------
-- Inventory history and the single, atomic path that moves stock.
--
-- Stock lives on product_variants, so adjustments are keyed on a variant.
-- product_id is carried alongside for reporting without a join.
--
-- admin_adjust_stock() is the only thing that should ever write
-- product_variants.stock_quantity from the dashboard: it locks the row, applies
-- the delta, refuses to go negative, records the history row and writes the
-- audit entry — all in one transaction, so a partial adjustment is impossible.
--
-- Rollback: drop the function, then the table.
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_adjustments (
  id                uuid primary key default gen_random_uuid(),
  variant_id        uuid not null references public.product_variants(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete cascade,
  admin_user_id     uuid not null,
  change_quantity   integer not null,
  previous_quantity integer not null,
  new_quantity      integer not null check (new_quantity >= 0),
  reason            text not null check (char_length(btrim(reason)) between 1 and 120),
  note              text check (note is null or char_length(note) <= 500),
  created_at        timestamptz not null default now(),
  constraint inventory_adjustments_delta_check
    check (new_quantity = previous_quantity + change_quantity),
  constraint inventory_adjustments_nonzero_check
    check (change_quantity <> 0)
);

comment on table public.inventory_adjustments is
  'Append-only stock movement history. Written only by public.admin_adjust_stock().';

create index if not exists idx_inventory_adj_variant on public.inventory_adjustments (variant_id, created_at desc);
create index if not exists idx_inventory_adj_created on public.inventory_adjustments (created_at desc);
create index if not exists idx_inventory_adj_product on public.inventory_adjustments (product_id, created_at desc);

create or replace function public.admin_adjust_stock(
  p_variant_id uuid,
  p_change     integer,
  p_reason     text,
  p_note       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_role       public.app_role := public.current_admin_role();
  v_previous   integer;
  v_new        integer;
  v_product_id uuid;
  v_label      text;
  v_name       text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if v_role is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Stok değişimi sıfır olamaz.' using errcode = 'check_violation';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Stok düzeltmesi için gerekçe zorunludur.' using errcode = 'check_violation';
  end if;

  -- Lock the variant so two concurrent adjustments cannot both read the same
  -- starting quantity.
  select pv.stock_quantity, pv.product_id, pv.label
  into v_previous, v_product_id, v_label
  from public.product_variants pv
  where pv.id = p_variant_id
  for update;

  if not found then
    raise exception 'Ürün seçeneği bulunamadı.' using errcode = 'no_data_found';
  end if;

  v_new := v_previous + p_change;

  -- The existing schema forbids negative stock and no business rule overrides
  -- that, so an over-decrement is rejected rather than clamped.
  if v_new < 0 then
    raise exception 'Stok negatife düşemez. Mevcut stok: %, istenen değişim: %', v_previous, p_change
      using errcode = 'check_violation';
  end if;

  update public.product_variants
  set stock_quantity = v_new
  where id = p_variant_id;

  select p.name into v_name from public.products p where p.id = v_product_id;

  insert into public.inventory_adjustments (
    variant_id, product_id, admin_user_id, change_quantity,
    previous_quantity, new_quantity, reason, note
  )
  values (
    p_variant_id, v_product_id, v_uid, p_change,
    v_previous, v_new, btrim(p_reason), nullif(btrim(coalesce(p_note, '')), '')
  );

  perform public.log_admin_action(
    'inventory.adjust',
    'product_variant',
    p_variant_id::text,
    jsonb_build_object('stock_quantity', v_previous),
    jsonb_build_object('stock_quantity', v_new),
    jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_name,
      'variant_label', v_label,
      'change', p_change,
      'reason', btrim(p_reason),
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'previous_quantity', v_previous,
    'new_quantity', v_new,
    'change', p_change
  );
end;
$$;

comment on function public.admin_adjust_stock(uuid, integer, text, text) is
  'Atomic, audited stock movement. Verifies the caller''s administrative role in its own body; never trusts a client-supplied administrator id.';

revoke execute on function public.admin_adjust_stock(uuid, integer, text, text) from public, anon;
grant  execute on function public.admin_adjust_stock(uuid, integer, text, text) to authenticated;

-- ---- RLS -------------------------------------------------------------------

alter table public.inventory_adjustments enable row level security;

drop policy if exists inventory_adj_admin_select on public.inventory_adjustments;
create policy inventory_adj_admin_select on public.inventory_adjustments
  for select to authenticated
  using (public.has_admin_role());

-- No write policy: the definer function is the only insert path.
revoke all on public.inventory_adjustments from anon, authenticated;
grant select on public.inventory_adjustments to authenticated;
