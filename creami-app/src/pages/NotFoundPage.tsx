import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <span className="text-6xl mb-4">🍦</span>
      <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
      <p className="text-lg text-slate-500 mb-8">This page melted away.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Browse all recipes
      </Link>
    </div>
  );
}
