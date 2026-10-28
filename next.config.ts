import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  staticPageGenerationTimeout: 60,
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Permissions-Policy', value: 'xr-spatial-tracking=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
