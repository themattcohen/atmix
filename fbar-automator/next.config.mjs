/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
  transpilePackages: ['react-pdf'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ]
  },
  webpack: (config) => {
    // pdfjs-dist optionally depends on the "canvas" Node.js native module.
    // Alias it to false so webpack does not attempt to bundle it.
    config.resolve.alias.canvas = false

    // pdfjs-dist ships ESM .mjs files. Tell webpack to treat them as
    // auto-detected JS modules so named exports work and Terser handles
    // the import/export syntax correctly.
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules[\\/]pdfjs-dist/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })

    return config
  },
}

export default nextConfig
