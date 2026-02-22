import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-text-secondary mb-4">404</h1>
        <p className="text-text-secondary mb-6">Page not found</p>
        <Link
          href="/"
          className="text-accent hover:text-accent/80 text-sm transition-colors"
        >
          Back to watchlist
        </Link>
      </div>
    </div>
  )
}
