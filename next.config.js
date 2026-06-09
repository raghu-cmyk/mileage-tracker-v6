/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
    serverComponentsExternalPackages: ['@node-rs/argon2'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), '@node-rs/argon2'];
    }
    return config;
  },
};

module.exports = nextConfig;
