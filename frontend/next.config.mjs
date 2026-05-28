import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const backend = process.env.BACKEND_PROXY_URL || "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  async headers() {
    // Avatar GLBs and their precomputed thumbnails are content-hashed by name
    // (one file per persona) and never mutate at the same URL, so pin them to
    // immutable for a year. Saves the 11–13 MB download on every repeat visit.
    return [
      {
        source: "/avatars/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
