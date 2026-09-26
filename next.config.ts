import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/projects/:id/timer/:action",
        destination: "/api/projects/:id/timer/:action",
      },
      {
        source: "/projects/:id/time-entries",
        destination: "/api/projects/:id/time-entries",
      },
    ];
  },
};

export default nextConfig;
