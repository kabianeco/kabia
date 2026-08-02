-- ---------------------------------------------------------------------------
-- Shop page hero banner.
--
-- Extends the site_settings key/value model (see 20260801000700_site_settings.sql)
-- with a single admin-managed promotional banner shown above the product grid
-- on /shop. No new table: this is exactly the "operationally editable content"
-- site_settings already exists for.
--
-- Rollback: drop the six shop_banner_* rows and revert the group_key check
-- constraint to its previous list. lib/settings.ts falls back to
-- shopBannerEnabled: false when the rows are missing, so removing them just
-- hides the banner rather than breaking the shop page.
-- ---------------------------------------------------------------------------

alter table public.site_settings
  drop constraint if exists site_settings_group_key_check;

alter table public.site_settings
  add constraint site_settings_group_key_check
  check (group_key in ('general', 'inventory', 'shipping', 'store', 'content', 'seo', 'shop_banner'));

insert into public.site_settings (key, value, value_type, label, group_key, is_public, is_sensitive) values
  ('shop_banner_enabled',   'false'::jsonb, 'boolean', 'Banner yayında', 'shop_banner', true, false),
  ('shop_banner_headline',  '""'::jsonb,    'string',  'Başlık',         'shop_banner', true, false),
  ('shop_banner_subtext',   '""'::jsonb,    'string',  'Alt metin',      'shop_banner', true, false),
  ('shop_banner_image_url', '""'::jsonb,    'string',  'Görsel URL',     'shop_banner', true, false),
  ('shop_banner_cta_label', '""'::jsonb,    'string',  'Buton metni',    'shop_banner', true, false),
  ('shop_banner_cta_href',  '""'::jsonb,    'string',  'Buton linki',    'shop_banner', true, false)
on conflict (key) do nothing;
