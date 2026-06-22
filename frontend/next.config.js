/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: 'next-build',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
