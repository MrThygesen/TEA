/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'da', 'de', 'fr', 'es', 'zh'],
    defaultLocale: 'en',
    localeDetection: true, // browser auto-detect
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.module.rules.push({
        test: /HeartbeatWorker\.js$/,
        type: 'asset/source', // Fix Terser issue
      });
    }
    return config;
  },
};

module.exports = nextConfig;

