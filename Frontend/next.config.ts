import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow Google profile picture domain
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    if (!process.env.BACKEND_URL) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

