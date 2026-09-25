import type { MetadataRoute } from "next"
import { site } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  // No trailing slashes: "Disallow: /sepet/" does not match "/sepet" itself,
  // which is the page. Every private route also carries noindex, since a
  // disallow alone does not keep a URL out of the index.
  //
  // /_next/ is not disallowed: it holds the scripts and styles a crawler needs
  // to render the pages it is allowed to see.
  const privatePaths = ["/admin", "/api", "/sepet", "/odeme", "/hesabim", "/giris", "/kayit", "/private"]
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      // Named groups replace the * group for that crawler, so each one repeats
      // the private paths rather than being handed the whole site.
      { userAgent: "GPTBot", allow: "/", disallow: privatePaths },
      { userAgent: "Googlebot-Image", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  }
}
