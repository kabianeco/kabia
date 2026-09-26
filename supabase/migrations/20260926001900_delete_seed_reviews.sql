-- ============================================================================
-- §8.4 (trust hygiene): delete the six seed reviews.
--
-- WHAT: scoped DELETE of the six fixture rows from the seed_reviews
-- migration (Ayşe Yılmaz, Mehmet Demir, Zeynep Kaya, Elif Şahin,
-- Can Öztürk, Deniz Aydın) — no account (user_id null), all flagged
-- is_verified_purchase = true, on the two inactive products
-- naturel-badem-250g / -500g. Snapshotted row-for-row in
-- db-snapshots/20260926-seed_reviews.json before deleting (pre-approved).
-- The AFTER DELETE trigger recomputes both products' rating_* to 0/empty so
-- reactivating them later cannot show invented verified reviews (verified
-- live post-apply).
--
-- ROLLBACK: re-insert from the snapshot file (ids preserved).
--
-- BACKWARD COMPATIBILITY: deployed code reads reviews; removing fixture rows
-- only removes invented content. No schema, policy or function change.
-- ============================================================================

delete from public.reviews
where id in (
  '5a55b8d5-95a8-4e2e-9c4d-b2db5b51f373',
  'cef98783-5459-4647-bc3b-654983a2b8ee',
  '0d729be4-750f-441a-b850-9dea12f21b6b',
  '048db59e-2df8-4476-aa08-7954158068e1',
  'e3a0e445-db3c-4bea-93c8-c5e1d3eaaf92',
  '65017bfa-3bc4-4533-bc68-d7e9225c8125'
);
