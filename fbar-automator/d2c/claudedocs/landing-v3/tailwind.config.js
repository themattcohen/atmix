
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        'gov-blue': '#1a4480',
        'gov-blue-dark': '#0b2d5b',
        'gov-blue-light': '#2e6bb0',
        'text-primary': '#1b1b1b',
        'text-secondary': '#5c5c5c',
        'bg-gray': '#f0f0f0',
        'bg-light': '#f5f7fa',
        'border-gray': '#d9d9d9',
        'alert-bg': '#fef3cd',
        'alert-border': '#b58b00',
        'trust-green': '#2e7d32',
      },
      fontFamily: {
        heading: ['Merriweather', 'serif'],
        body: ['"Source Sans Pro"', 'sans-serif'],
      },
      maxWidth: {
        'doc': '960px',
      },
      borderRadius: {
        'none': '0px',
        DEFAULT: '0px',
        'sm': '0px',
        'md': '0px',
        'lg': '0px',
        'xl': '0px',
        '2xl': '0px',
        '3xl': '0px',
        'full': '0px',
      },
      boxShadow: {
        'none': 'none',
        DEFAULT: 'none',
        'sm': 'none',
        'md': 'none',
        'lg': 'none',
        'xl': 'none',
        '2xl': 'none',
      }
    },
  },
  plugins: [],
}
