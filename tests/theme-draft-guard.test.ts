import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// S28: the first draft save must never publish by side effect. A live
// missing-row test needs a scratch database (see migration header); the
// shape is pinned here database-free.

describe("S28 theme draft first-insert guard", () => {
  const src = readFileSync(
    "supabase/migrations/20260926001600_theme_draft_no_silent_publish.sql",
    "utf8",
  );

  it("updates the draft instead of upserting a published row", () => {
    assert.match(src, /update public\.site_theme_settings/);
    assert.match(src, /raise exception 'Tema satırı bulunamadı\.' using errcode = 'P0002'/);
    assert.ok(!src.includes("published_config"), "draft path writes no published_config");
    assert.ok(!src.includes("on conflict"), "no upsert");
  });
});
