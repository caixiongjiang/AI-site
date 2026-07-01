/** @type {import('next').NextConfig} */
const skillServiceUrl =
  process.env.SKILL_SERVICE_URL || "http://localhost:8001";

const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: ["192.168.35.11"],
  async rewrites() {
    return [
      {
        source: "/skill-api/:path*",
        destination: `${skillServiceUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
