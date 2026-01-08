/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Courier New', 'monospace'],
        fraunces: ['Fraunces', 'serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      colors: {
        walkies: {
          forest: '#2d4a3e',
          sage: '#7d9b8a',
          cream: '#f8f5f0',
          'warm-white': '#fffef9',
          bark: '#3d3129',
          trail: '#c4b49a',
          sunrise: '#e8a87c',
          sky: '#89b4c8',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'fade-slide-up': 'fadeSlideUp 0.6s ease-out',
        'fade-slide-up-1': 'fadeSlideUp 0.6s ease-out 0.1s backwards',
        'fade-slide-up-2': 'fadeSlideUp 0.6s ease-out 0.2s backwards',
        'fade-slide-up-3': 'fadeSlideUp 0.6s ease-out 0.3s backwards',
        'fade-slide-up-4': 'fadeSlideUp 0.6s ease-out 0.4s backwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
        },
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
