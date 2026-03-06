import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="section-padding">
      <div className="container-content flex flex-col items-center justify-center text-center py-16">
        <h1 className="text-5xl md:text-6xl font-heading font-bold text-alpine-blue mb-4">
          Page Not Found
        </h1>
        <p className="text-lg text-text-secondary mb-8 max-w-md">
          Sorry, we couldn&rsquo;t find the page you&rsquo;re looking for. It may have been
          moved or no longer exists.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
          <Link
            href="/contact"
            className="inline-block border-2 border-alpine-blue text-alpine-blue font-semibold py-3 px-8 rounded-lg hover:bg-alpine-blue/5 transition-colors text-center"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
