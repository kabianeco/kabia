import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
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
  async redirects() {
    return [
      // The concept build shipped the store at /magaza before the real shop
      // existed. Keep the URL alive.
      { source: "/magaza", destination: "/shop", permanent: true },
      // The farm and contact pages are now sections of the homepage.
      { source: "/farm", destination: "/#ciftlik", permanent: true },
      { source: "/contact", destination: "/#iletisim", permanent: true },
    ];
  },
};

export default nextConfig;
