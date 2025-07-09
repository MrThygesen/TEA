/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      // Treat HeartbeatWorker.js as a static resource (emit file, no parsing)
      config.module.rules.push({
        test: /HeartbeatWorker\.js$/,
        type: 'asset/resource',
      });
    }
    return config;
  },
};

module.exports = nextConfig;

