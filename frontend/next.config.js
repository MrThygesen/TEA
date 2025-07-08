// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.minimizer = config.optimization.minimizer.map((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          plugin.options.exclude = /HeartbeatWorker\.js$/;
        }
        return plugin;
      });
    }
    return config;
  },
};

module.exports = nextConfig;

