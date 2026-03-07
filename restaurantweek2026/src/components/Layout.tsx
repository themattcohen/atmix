import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <span className="font-bold text-lg text-slate-900 group-hover:text-red-700 transition-colors">
                DRW Explorer
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link
                to="/"
                className="text-slate-600 hover:text-red-700 transition-colors font-medium"
              >
                Restaurants
              </Link>
              <a
                href="https://denverrestaurantweek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-red-700 transition-colors font-medium"
              >
                Official Site
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <p>
              Data from{' '}
              <a
                href="https://denverrestaurantweek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-700 hover:underline"
              >
                Denver Restaurant Week
              </a>
              {' '}| March 6-15, 2026
            </p>
            <p>
              Built by{' '}
              <a
                href="https://atmix.org"
                className="text-red-700 hover:underline"
              >
                atmix.org
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
