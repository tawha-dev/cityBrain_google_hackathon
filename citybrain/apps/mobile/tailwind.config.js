/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ops: {
          bg: '#0B0F14',
          panel: '#121820',
          border: '#1E2A38',
          accent: '#00FFC6',
          warn: '#FFB020',
          danger: '#FF3B5C',
          muted: '#6B7A8F',
        },
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
