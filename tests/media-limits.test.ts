import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEDIA_MAX_BYTES, MEDIA_BUCKET } from "@/lib/admin/media";

// S25: app limit and bucket limit must agree. Verified live 2026-09-26:
// storage.buckets[product-media].file_size_limit = 10485760 (10 MB), equal
// to MEDIA_MAX_BYTES — aligned, no code change. This test pins the alignment
// database-free so a future one-sided change fails loudly.

describe("S25 media size alignment", () => {
  it("app constant is 10 MB on the product-media bucket", () => {
    assert.equal(MEDIA_BUCKET, "product-media");
    assert.equal(MEDIA_MAX_BYTES, 10 * 1024 * 1024);
  });

  it("latest migration sets the bucket to the same 10 MB", () => {
    const sql = readFileSync(
      "supabase/migrations/20260801004000_media_assets.sql",
      "utf8",
    );
    assert.match(sql, /file_size_limit = 10485760/);
  });

  it("the upload core enforces the app's own (smaller) upload cap, stated in its message", () => {
    const src = readFileSync("lib/admin/media-upload.ts", "utf8");
    assert.match(src, /MEDIA_UPLOAD_MAX_BYTES/);
    assert.match(src, /Dosya 4 MB sınırını aşıyor\./);
  });
});
