import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles deployment automatically — don't use standalone output
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
