/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      // Add a rule to treat HeartbeatWorker.js as raw
      config.module.rules.push({
        test: /HeartbeatWorker\.js$/,
        type: 'asset/resource', // prevents parsing/minifying
      });
    }
    return config;
  },
};

module.exports = nextConfig;

