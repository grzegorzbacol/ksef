/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  basePath: "/dashboard",
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/", destination: "/dashboard", permanent: false },
    ];
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
