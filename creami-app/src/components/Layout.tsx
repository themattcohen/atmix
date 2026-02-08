import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <span className="text-2xl">🍦</span>
              <span className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">
                Ice Creamery
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link
                to="/"
                className="text-slate-600 hover:text-indigo-600 transition-colors font-medium"
              >
                Recipes
              </Link>
              <a
                href="https://atmix.org"
                className="text-slate-600 hover:text-indigo-600 transition-colors font-medium"
              >
                atmix.org
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
              Recipes from{' '}
              <a
                href="https://github.com/jhermann/ice-creamery"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                jhermann/ice-creamery
              </a>
            </p>
            <p>
              Built by{' '}
              <a
                href="https://atmix.org"
                className="text-indigo-600 hover:underline"
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
