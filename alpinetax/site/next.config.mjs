import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  output: 'standalone',
  async redirects() {
    return [
      // Old GoDaddy site paths → new site equivalents
      {
        source: '/services-%26-fees',
        destination: '/pricing',
        permanent: true,
      },
      {
        source: '/schedule-a-meeting',
        destination: '/schedule',
        permanent: true,
      },
      {
        source: '/m/account',
        destination: '/client-portal',
        permanent: true,
      },
      {
        source: '/m/bookings',
        destination: '/schedule',
        permanent: true,
      },
      {
        source: '/m/create-account',
        destination: '/client-portal',
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
  },
});

export default withMDX(nextConfig);
