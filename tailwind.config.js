/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./usmiv/mockups/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Courier New', 'monospace'],
        fraunces: ['Fraunces', 'serif'],
        dm: ['DM Sans', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        opensans: ['"Open Sans"', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
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
        usml: {
          navy: '#1B4D6E',
          coral: '#E07A5F',
          sage: '#5B8C6F',
          gold: '#D4A574',
          cream: '#F7F5F2',
          dark: '#0A1F2E',
          charcoal: '#2D2D2D',
        },
        labs: {
          accent: '#C17B3A',
          'accent-dark': '#A66830',
          'accent-light': '#D4944F',
        },
        iv: {
          light: '#EAF4FB',
          border: '#BFDFF3',
          blog: '#EDF0F7',
        },
        audit: {
          medics: '#07b6b6',
          iv: '#44B7BC',
          navy: '#1E4969',
          dark: '#081E2B',
          'medics-dark': '#047c7c',
          'iv-dark': '#2A8A8F',
          cream: '#f8f7f4',
          grade: {
            a: '#22c55e',
            b: '#3b82f6',
            c: '#f59e0b',
            d: '#ef4444',
            f: '#991b1b',
          },
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'fade-slide-up': 'fadeSlideUp 0.6s ease-out',
        'fade-slide-up-1': 'fadeSlideUp 0.6s ease-out 0.1s backwards',
        'fade-slide-up-2': 'fadeSlideUp 0.6s ease-out 0.2s backwards',
        'fade-slide-up-3': 'fadeSlideUp 0.6s ease-out 0.3s backwards',
        'fade-slide-up-4': 'fadeSlideUp 0.6s ease-out 0.4s backwards',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
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
