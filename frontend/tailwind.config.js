/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        wave: 'moveWaves 15s linear infinite',
        'spin-slow': 'spin 60s linear infinite',
        'neon-pulse': 'neonPulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        moveWaves: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50px)' },
        },
        neonPulse: {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 6px #22d3ee) drop-shadow(0 0 12px #0891b2)',
          },
          '50%': {
            filter: 'drop-shadow(0 0 18px #67e8f9) drop-shadow(0 0 36px #22d3ee)',
          },
        },
      },
      clipPath: {
        'wave-bottom': 'polygon(0% 100%, 0% 30%, 10% 20%, 20% 25%, 30% 10%, 40% 20%, 50% 0%, 60% 10%, 70% 0%, 80% 15%, 90% 10%, 100% 20%, 100% 100%)',
      },
    },
  },
  plugins: [],
}

