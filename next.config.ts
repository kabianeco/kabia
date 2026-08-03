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
      // Preserve the historical typo with one directed edge. Nothing ever
      // points back to it, so the redirect graph cannot form a cycle.
      { source: "/admin/apperance", destination: "/admin/appearance", permanent: true },
      // The farm and contact pages are now sections of the homepage.
      { source: "/farm", destination: "/#ciftlik", permanent: true },
      { source: "/contact", destination: "/#iletisim", permanent: true },
    ];
  },
};

export default nextConfig;
