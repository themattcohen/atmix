/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for better-sqlite3 native addon
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },

  // eBay image CDN
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ebayimg.com' },
      { protocol: 'https', hostname: '*.ebayimg.com' },
    ],
  },

  // Exclude native modules from client bundles
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3']
    }
    return config
  },
}

module.exports = nextConfig
