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
  images: {
    formats: ["image/avif", "image/webp"],
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
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "@react-three/fiber", "@react-three/drei", "sonner"],
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
