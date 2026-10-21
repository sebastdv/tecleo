import type { NextConfig } from 'next';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:4100';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // La API REST se sirve bajo el mismo dominio que la web para que la cookie
  // httpOnly del refresh token sea de primera parte (ver docs/decisiones.md).
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${serverUrl}/:path*` }]);
  },
};

export default nextConfig;
