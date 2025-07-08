/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',        // All Next.js pages
    './components/**/*.{js,ts,jsx,tsx}',   // Your React components
    './app/**/*.{js,ts,jsx,tsx}',          // If you're using app directory
  ],
  theme: {
    extend: {
      // Optional customizations (colors, fonts, etc.)
      // Example:
      colors: {
        tea: {
          DEFAULT: '#00A86B',
          light: '#E6FFF5',
          dark: '#007a4d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  darkMode: 'class', // Optional: use 'media' if you want system preference only
  plugins: [],
}

