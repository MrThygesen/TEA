/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['en', 'da', 'de', 'fr'],
    defaultLocale: 'en',
    localeDetection: true, // Uses browser language if no /lang path
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

