import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Images from Twitch CDN and Supabase Storage
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  // Security headers — applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Block embedding in iframes (clickjacking defense)
          { key: "X-Frame-Options", value: "DENY" },
          // Force HTTPS for 2 years including subdomains; allow preload list
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Don't leak full URLs to third parties; send origin only on cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser APIs we never use
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
