/** @type {import('tailwindcss').Config} */
// Brand tokens ported verbatim from public/ss/index.html lines 21-32 (Someday landing).
// Any future Someday rebrand updates here and propagates to the valuation app.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        someday: {
          forest: '#1D3A28',
          'forest-light': '#2D5040',
          cream: '#F5F0E8',
          'cream-light': '#FAFAF7',
          gold: '#B8972E',
          'gold-light': '#D4B850',
          slate: '#2E2E2E',
          'slate-mid': '#5A5A5A',
          'slate-muted': '#8A8A8A',
          hairline: '#E5DDC9',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // Brand-matched display sizes from public/ss/index.html
        'display-xl': ['clamp(36px, 5.5vw, 60px)', { lineHeight: '1.18', fontWeight: '600' }],
        'display-lg': ['clamp(28px, 4vw, 38px)', { lineHeight: '1.2', fontWeight: '600' }],
        'display-md': ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'section-label': ['11px', { lineHeight: '1', letterSpacing: '0.2em', fontWeight: '700' }],
      },
      borderRadius: {
        // Brand default is 3px on buttons, cards, form inputs
        DEFAULT: '3px',
      },
    },
  },
  plugins: [],
};
