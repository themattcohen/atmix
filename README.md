# atmix.org

Personal portfolio site for Matt Cohen, CPA - featuring two design variants.

## Features

- **Two Design Routes**:
  - `/brutalist` - Minimalist brutalist design
  - `/warm` - Warm professional design
- **Built with**: Vite + React + TypeScript + Tailwind CSS
- **Deployed on**: GitHub Pages with automated CI/CD

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Automatic deployment to GitHub Pages via GitHub Actions on push to `main` branch.

## Tech Stack

- **Vite 5.x** - Fast build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router 6** - Client-side routing
- **GitHub Pages** - Static hosting
- **GitHub Actions** - CI/CD pipeline

## Project Structure

```
atmix/
├── src/
│   ├── pages/
│   │   ├── Brutalist.tsx
│   │   └── Warm.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── logo.png
├── .github/
│   └── workflows/
│       └── deploy.yml
└── ...config files
```

## License

© 2025 Matt Cohen
