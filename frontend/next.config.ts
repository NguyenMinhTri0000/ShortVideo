import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const upstream = process.env.API_UPSTREAM || 'http://127.0.0.1:23001';
    return [
      {
        source: '/api/:path*',
        destination: `${upstream}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
