#!/usr/bin/env node
// Validates the Google Merchant Center feed against Google's product data
// specification (support.google.com/merchants/answer/7052112) and checks that
// every item's landing page shows the item's price.
//
//   node scripts/validate-merchant-feed.mjs https://kabiaekolojik.com
//   node scripts/validate-merchant-feed.mjs http://localhost:3207 --site=https://kabiaekolojik.com
//
// --site: the origin item links must use (default: the origin fetched). A
// local build links to the configured site URL, not to localhost; landing
// pages are then fetched from the local origin. --no-landing skips them.
//
// Exit 1 on any error. Warnings are things the feed deliberately leaves out
// until the owner supplies the fact (shipping, returns, some brands).

const base = (process.argv[2] ?? "").replace(/\/+$/, "")
const checkLanding = !process.argv.includes("--no-landing")
const siteArg = process.argv.find((a) => a.startsWith("--site="))?.slice("--site=".length)
if (!/^https?:\/\//.test(base)) {
  console.error("usage: validate-merchant-feed.mjs <origin> [--site=<origin>] [--no-landing]")
  process.exit(2)
}

const res = await fetch(`${base}/feeds/google-merchant.xml`)
if (!res.ok) {
  console.error(`feed: HTTP ${res.status}`)
  process.exit(1)
}
const contentType = res.headers.get("content-type") ?? ""
const xml = await res.text()

const errors = []
const warnings = []
const err = (msg) => errors.push(msg)
const warn = (msg) => warnings.push(msg)

if (!contentType.includes("xml")) err(`feed: content-type is "${contentType}", not XML`)
if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) err("feed: missing UTF-8 XML declaration")
if (!/<rss version="2\.0" xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0">/.test(xml)) err("feed: not RSS 2.0 with the g: namespace")

const unescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
  const fields = {}
  for (const f of m[1].matchAll(/<([a-z:_]+)>([\s\S]*?)<\/\1>/g)) (fields[f[1]] ??= []).push(unescape(f[2]))
  return fields
})
if (items.length === 0) err("feed: no items")

const one = (item, key) => item[key]?.[0]
const ids = new Set()
const groups = new Map()
const AVAILABILITY = new Set(["in_stock", "out_of_stock", "preorder", "backorder"])
const CONDITION = new Set(["new", "refurbished", "used"])
const isHttpUrl = (u) => /^https?:\/\/[^\s]+$/.test(u ?? "")
const origin = new URL(siteArg ?? base).origin

for (const item of items) {
  const id = one(item, "g:id")
  const at = `item ${id ?? "(no id)"}`
  // Required for every product.
  if (!id) err(`${at}: g:id missing`)
  else if (id.length > 50) err(`${at}: g:id longer than 50`)
  else if (ids.has(id)) err(`${at}: duplicate g:id`)
  ids.add(id)
  const title = one(item, "title")
  if (!title) err(`${at}: title missing`)
  else if (title.length > 150) err(`${at}: title longer than 150`)
  const description = one(item, "description")
  if (!description) err(`${at}: description missing`)
  else if (description.length > 5000) err(`${at}: description longer than 5000`)
  const link = one(item, "link")
  if (!isHttpUrl(link)) err(`${at}: link is not an absolute URL`)
  else if (new URL(link).origin !== origin) err(`${at}: link is on ${new URL(link).origin}, not ${origin}`)
  if (!isHttpUrl(one(item, "g:image_link"))) err(`${at}: g:image_link missing or not absolute`)
  if ((item["g:additional_image_link"]?.length ?? 0) > 10) err(`${at}: more than 10 additional images`)
  for (const u of item["g:additional_image_link"] ?? []) if (!isHttpUrl(u)) err(`${at}: additional image not absolute`)
  if (!AVAILABILITY.has(one(item, "g:availability"))) err(`${at}: g:availability "${one(item, "g:availability")}"`)
  const price = one(item, "g:price")
  if (!/^\d+\.\d{2} TRY$/.test(price ?? "")) err(`${at}: g:price "${price}" is not "<amount> TRY"`)
  else if (!(Number(price.split(" ")[0]) > 0)) err(`${at}: g:price is zero`)
  if (!CONDITION.has(one(item, "g:condition"))) err(`${at}: g:condition "${one(item, "g:condition")}"`)
  // Brand is required for new products; without a GTIN and MPN,
  // identifier_exists must say so.
  if (!one(item, "g:brand")) warn(`${at} (${title}): g:brand missing — needs the owner's brand for this producer's product`)
  if (!one(item, "g:gtin") && !one(item, "g:mpn") && one(item, "g:identifier_exists") !== "no")
    err(`${at}: no GTIN/MPN but identifier_exists is not "no"`)
  // Variants: a group shares one item_group_id and differs by size.
  const group = one(item, "g:item_group_id")
  if (group) {
    if (group.length > 50) err(`${at}: g:item_group_id longer than 50`)
    if (!one(item, "g:size")) err(`${at}: grouped item without g:size`)
    const sizes = groups.get(group) ?? []
    sizes.push(one(item, "g:size"))
    groups.set(group, sizes)
  }
  // Deliberately absent until the owner confirms the terms.
  if (!item["g:shipping"]) warn(`${at}: no g:shipping — set shipping in the Merchant Center account once the fee is confirmed`)
}
for (const [group, sizes] of groups) {
  if (new Set(sizes).size !== sizes.length) err(`group ${group}: two items share a size`)
}

// The landing page must show the item's price (Merchant Center's price check).
if (checkLanding) {
  const tl = (amount) => `₺${amount.toFixed(2).replace(".", ",")}`
  for (const item of items) {
    const link = one(item, "link")
    const price = Number((one(item, "g:price") ?? "0").split(" ")[0])
    try {
      const page = await fetch(link.replace(/^https?:\/\/[^/]+/, base))
      if (page.status !== 200) {
        err(`item ${one(item, "g:id")}: landing page HTTP ${page.status}`)
        continue
      }
      const html = await page.text()
      if (!html.includes(tl(price))) err(`item ${one(item, "g:id")}: landing page does not show ${tl(price)}`)
      const oos = one(item, "g:availability") === "out_of_stock"
      if (oos !== /Stokta yok/.test(html))
        err(`item ${one(item, "g:id")}: feed says ${one(item, "g:availability")}, the page ${oos ? "does not say" : "says"} "Stokta yok"`)
    } catch (e) {
      err(`item ${one(item, "g:id")}: landing page fetch failed (${e.message})`)
    }
  }
}

const summarize = (list) => {
  const counts = new Map()
  for (const line of list) {
    const key = line.replace(/^item [^:]+(?: \([^)]*\))?: /, "")
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([k, n]) => `  ${n}× ${k}`).join("\n")
}
console.log(`${items.length} items, ${groups.size} variant groups, ${errors.length} errors, ${warnings.length} warnings`)
if (errors.length) console.log(`errors:\n${errors.map((e) => `  ${e}`).join("\n")}`)
if (warnings.length) console.log(`warnings (grouped):\n${summarize(warnings)}`)
process.exitCode = errors.length ? 1 : 0
