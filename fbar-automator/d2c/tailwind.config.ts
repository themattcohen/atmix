import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // V3 governmental design tokens
        "gov-blue": "#1a4480",
        "gov-blue-dark": "#0b2d5b",
        "gov-blue-light": "#2e6bb0",
        "text-primary": "#1b1b1b",
        "text-secondary": "#5c5c5c",
        "bg-gray": "#f0f0f0",
        "bg-light": "#f5f7fa",
        "border-gray": "#d9d9d9",
        "alert-bg": "#fef3cd",
        "alert-border": "#b58b00",
        "trust-green": "#2e7d32",
        // USWDS-inspired navy/white/gold palette
        navy: {
          50: "#e8edf3",
          100: "#c5d1e1",
          200: "#9fb3cd",
          300: "#7895b9",
          400: "#5b7faa",
          500: "#3e699b",
          600: "#355a85",
          700: "#2a476a",
          800: "#1f3550",
          900: "#112e51",
          950: "#0a1b30",
        },
        gold: {
          50: "#fdf6e8",
          100: "#fbe9c0",
          200: "#f8da95",
          300: "#f5cb6a",
          400: "#f2bf4a",
          500: "#e59f37",
          600: "#d08b2e",
          700: "#b07324",
          800: "#905c1b",
          900: "#704812",
        },
        // CSS custom property colors for shadcn/ui components
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        none: "0px",
        DEFAULT: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "0px",
      },
      boxShadow: {
        none: "none",
        DEFAULT: "none",
        sm: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        serif: ["var(--font-merriweather)", "Georgia", "serif"],
        heading: ["var(--font-merriweather)", "serif"],
        body: ["var(--font-source-sans)", "'Source Sans Pro'", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        doc: "960px",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
