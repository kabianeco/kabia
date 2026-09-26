-- ============================================================================
-- §8.2 (homepage introduction selection): three settings keys choosing each
-- source's intro product. Seeded to today's curated slugs so the rendered
-- homepage is identical; the homepage reads them with fallback to the
-- curated entries when unset or unreadable.
--
-- BACKWARD COMPATIBILITY: purely additive public non-sensitive string keys;
-- deployed code ignores unknown keys (no KEY_MAP entry there). Seeded with
-- ON CONFLICT DO NOTHING so replays never overwrite an administered choice.
-- ============================================================================

insert into public.site_settings (key, value, value_type, label, group_key, is_public, is_sensitive) values
  ('intro_product_ciftlik', '"kabuklu-badem"'::jsonb, 'string', 'Giriş ürünü — Çiftlik', 'content', true, false),
  ('intro_product_secki',   '"findik-ici"'::jsonb,    'string', 'Giriş ürünü — Seçki',   'content', true, false),
  ('intro_product_mutfak',  '"tarhana"'::jsonb,       'string', 'Giriş ürünü — Mutfak',  'content', true, false)
on conflict (key) do nothing;
