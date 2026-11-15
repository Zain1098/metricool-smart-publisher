/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      { source: '/terms-and-conditions', destination: '/terms' },
      { source: '/terms-of-service', destination: '/terms' },
      { source: '/tos', destination: '/terms' },
      { source: '/privacy-policy', destination: '/privacy' },
    ];
  },
};

export default nextConfig;
