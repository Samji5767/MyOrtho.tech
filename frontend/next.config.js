/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: 'next-build',

  images: {
    unoptimized: true,
  },

  // Strip all console.* calls from production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Reduce JS payload
  experimental: {
    // Tree-shake barrel re-exports
    optimizePackageImports: [
      'lucide-react',
      '@react-three/fiber',
      '@react-three/drei',
    ],
  },

  // Suppress harmless Three.js peer-dep warnings in build output
  webpack(config, { isServer }) {
    if (!isServer) {
      // Replace node-only modules referenced by three.js extras with empty shims
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
