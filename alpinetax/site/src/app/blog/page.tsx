import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Tax Tips & Resources',
  description:
    'Tax preparation tips, small business tax strategies, and financial insights from Alpine Tax & Consulting in Denver, CO.',
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <>
      <section className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[{ label: 'Home', href: '/' }, { label: 'Blog' }]}
          />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-alpine-blue mb-4">
            Tax Tips &amp; Resources
          </h1>
          <p className="text-lg text-text-secondary mb-12 max-w-2xl">
            Practical tax guidance for individuals and small business owners in
            Denver and beyond.
          </p>

          {posts.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-8">
              {posts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <time
                    dateTime={post.date}
                    className="text-sm text-text-secondary"
                  >
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  {post.category && (
                    <span className="ml-3 text-sm font-medium text-alpine-teal">
                      {post.category}
                    </span>
                  )}
                  <h2 className="mt-2 text-xl font-heading font-semibold text-alpine-blue group-hover:text-alpine-teal transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-text-secondary line-clamp-3">
                    {post.description}
                  </p>
                  <span className="mt-4 inline-block text-alpine-teal font-medium">
                    Read More &rarr;
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 rounded-xl bg-alpine-cream/50">
              <p className="text-lg text-text-secondary mb-2">
                We&apos;re working on some great content for you.
              </p>
              <p className="text-text-secondary">
                In the meantime, check out our{' '}
                <Link
                  href="/faq"
                  className="text-alpine-teal font-medium hover:underline"
                >
                  FAQ
                </Link>{' '}
                for answers to common tax questions.
              </p>
            </div>
          )}
        </div>
      </section>
      <CallToAction />
    </>
  );
}
