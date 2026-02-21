import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        raised: '#21262d',
        border: '#30363d',
        'text-primary': '#e6edf3',
        'text-secondary': '#8b949e',
        accent: '#1d6ab5',
        status: {
          active: '#22c55e',
          sold: '#ef4444',
          ended: '#6b7280',
          relisted: '#3b82f6',
        },
        urgency: {
          normal: '#22c55e',
          caution: '#eab308',
          urgent: '#ef4444',
        },
        delta: {
          drop: '#22c55e',
          rise: '#ef4444',
        },
      },
    },
  },
  plugins: [],
}

export default config
