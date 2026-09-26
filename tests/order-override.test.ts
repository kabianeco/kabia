import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Bug 2: admin_override_order_status ALTER TABLE ... DISABLE TRIGGER
// enforce_order_status_transition kullanıyordu; canlıdaki ad
// trg_orders_status_transition olduğu için 42704 ile düşüyordu.
// Çözüm: işlem-yerel kabia.allow_status_override bayrağı.

describe("order override flag (Bug 2 regression)", () => {
  const fix = readFileSync(
    "supabase/migrations/20260927000100_order_override_flag.sql",
    "utf8",
  );

  it("trigger admits the audited override flag and keeps the matrix", () => {
    assert.match(fix, /kabia\.allow_status_override/);
    assert.match(
      fix,
      /hazirlaniyor' and new\.status in \('kargoda', 'teslim_edildi', 'iptal_edildi'\)/,
    );
  });

  it("override sets the flag instead of ALTER TABLE ... DISABLE TRIGGER", () => {
    const body = fix
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    assert.ok(!body.includes("DISABLE TRIGGER"), "DDL bypass kalmamalı");
    assert.ok(!body.includes("ENABLE TRIGGER"), "DDL bypass kalmamalı");
    assert.match(fix, /set_config\('kabia\.allow_status_override', 'on', true\)/);
    assert.match(fix, /set_config\('kabia\.allow_order_write', 'on', true\)/);
  });

  it("override still gates super_admin + mandatory reason", () => {
    assert.match(fix, /if not public\.is_super_admin\(\)/);
    assert.match(fix, /Geçersiz durum geçişi için bir gerekçe/);
  });
});
