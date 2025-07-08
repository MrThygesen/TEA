const TerserPlugin = require('terser-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.minimizer = [
        new TerserPlugin({
          exclude: /HeartbeatWorker\.js$/, // exclude this file from minification
          terserOptions: {
            compress: true,
            mangle: true,
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ];
    }
    return config;
  },
};

module.exports = nextConfig;

