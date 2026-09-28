import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// SEO/perf pass 2, phase 2: structured data and crawl contracts. Each states
// only what the site visibly states (brief §2 Truth).

describe("Organization structured data", () => {
  const layout = readFileSync("app/layout.tsx", "utf8")

  it("claims only the social profiles confirmed to exist", () => {
    assert.match(layout, /sameAs: \[site\.social\.instagram, site\.social\.facebook\]/)
    assert.ok(!/sameAs:[^\n]*social\.x/.test(layout), "x.com/kabiaekolojik is unconfirmed")
    assert.ok(!/creator: "@kabiaekolojik"/.test(layout), "twitter:creator names the unconfirmed X handle")
  })

  it("states the contact details /iletisim shows, as a contactPoint", () => {
    const contact = readFileSync("app/iletisim/page.tsx", "utf8")
    assert.match(contact, /Hafta içi 09:00–18:00/)
    assert.match(layout, /"@type": "ContactPoint"/)
    assert.match(layout, /opens: "09:00",\s+closes: "18:00"/)
    assert.ok(!layout.includes('"@type": "LocalBusiness"'))
  })
})
