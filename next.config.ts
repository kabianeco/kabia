import type { NextConfig } from "next";

let supabaseHost: string | undefined
try {
  supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL.trim()).hostname
    : undefined
} catch {
  supabaseHost = undefined
}

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Product imagery is served from Supabase Storage; the seeded catalogue
    // still points at picsum placeholders. Both are allow-listed so next/image
    // can optimise them instead of falling back to unoptimised delivery.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost }]
        : []),
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "sonner"],
  },
  async redirects() {
    return [
      // Preserve the historical typo with one directed edge. Nothing ever
      // points back to it, so the redirect graph cannot form a cycle.
      { source: "/admin/apperance", destination: "/admin/appearance", permanent: true },
      // The farm and contact pages are now sections of the homepage.
      { source: "/farm", destination: "/#ciftlik", permanent: true },
      // Producer slug typo fix (2026-09-28): geyce-setce-findik was renamed
      // to geyve-setce-findik in the database. Permanent wildcard redirects
      // so every old URL — story, shelf, OG images — lands on the new one.
      // Nothing ever points back to the old slug, so no cycle is possible.
      {
        source: "/ureticiler/geyce-setce-findik",
        destination: "/ureticiler/geyve-setce-findik",
        permanent: true,
      },
      {
        source: "/ureticiler/geyce-setce-findik/:path*",
        destination: "/ureticiler/geyve-setce-findik/:path*",
        permanent: true,
      },
      {
        source: "/magaza/geyce-setce-findik",
        destination: "/magaza/geyve-setce-findik",
        permanent: true,
      },
      {
        source: "/magaza/geyce-setce-findik/:path*",
        destination: "/magaza/geyve-setce-findik/:path*",
        permanent: true,
      },
      { source: "/contact", destination: "/#iletisim", permanent: true },
      // /magaza is the storefront's one listing URL; /shop rendered the same
      // page under a second URL. Product pages stay at /shop/<slug> — this
      // matches /shop exactly, and the query string carries over.
      { source: "/shop", destination: "/magaza", permanent: true },
    ];
  },
};

export default nextConfig;
