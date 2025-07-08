/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer && config.optimization.minimizer) {
      config.optimization.minimizer.forEach((plugin) => {
        if (plugin.constructor.name === 'TerserPlugin') {
          // Exclude HeartbeatWorker.js from minification
          plugin.options.exclude = /HeartbeatWorker\.js$/;
        }
      });
    }
    return config;
  },
};

module.exports = nextConfig;

