/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.module.rules.push({
        test: /HeartbeatWorker\.js$/,
        type: 'asset/source',  // Fix Terser issue
      });
    }

    return config;
  },
};

module.exports = nextConfig;

