/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'trust-teal': '#147E7E',
        'ledger-gold': '#FFC857',
        'espresso-black': '#2B2B2B',
        'pure-white': '#FFFFFF',
        'trail-green': '#5A9367',
      },
      fontFamily: {
        'mono': ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        pulseGlow: {
          '0%': {
            boxShadow: '0 0 20px rgba(20, 126, 126, 0.4)',
          },
          '100%': {
            boxShadow: '0 0 40px rgba(20, 126, 126, 0.6)',
          },
        },
      },
      boxShadow: {
        'trust': '0 10px 25px rgba(20, 126, 126, 0.3)',
        'gold': '0 10px 25px rgba(255, 200, 87, 0.3)',
        'green': '0 10px 25px rgba(90, 147, 103, 0.3)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
};