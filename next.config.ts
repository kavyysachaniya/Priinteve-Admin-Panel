import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/projects/:id/assignments",
        destination: "/api/projects/:id/assignments",
      },
      {
        source: "/projects/:id/assignments/:employeeId",
        destination: "/api/projects/:id/assignments/:employeeId",
      },
      {
        source: "/projects/:id/tasks",
        destination: "/api/projects/:id/tasks",
      },
      {
        source: "/projects/:id/timer/:action",
        destination: "/api/projects/:id/timer/:action",
      },
      {
        source: "/timer/:action",
        destination: "/api/timer/:action",
      },
      {
        source: "/projects/:id/time-entries",
        destination: "/api/projects/:id/time-entries",
      },
      {
        source: "/time-entries/:id",
        destination: "/api/time-entries/:id",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
