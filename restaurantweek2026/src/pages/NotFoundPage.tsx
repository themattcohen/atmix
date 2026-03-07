import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">404</h1>
      <p className="text-slate-500 mb-8">Page not found</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors text-sm font-medium"
      >
        Back to restaurants
      </Link>
    </div>
  );
}
