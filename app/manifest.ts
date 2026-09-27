import type { MetadataRoute } from "next"
import { site } from "@/lib/site"
import { getPublicSettings } from "@/lib/settings"

/**
 * Web manifest: name, colors and icons for install/add-to-homescreen.
 * Icons reuse the SVG leaf mark; PNG sizes need rasterized artwork (owner
 * asset — noted in the SEO/perf report).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getPublicSettings()
  return {
    name: settings.storeName,
    short_name: "Kabia",
    description: settings.seoDefaultDescription,
    start_url: "/",
    display: "standalone",
    lang: "tr",
    background_color: "#f4f1e8",
    theme_color: "#f4f1e8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
