import type { Metadata } from 'next';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'FBAR Filing Blog — Guides, Deadlines & Compliance Tips',
  description: 'Expert guides on FBAR filing requirements, deadlines, penalties, and compliance tips from a licensed CPA.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndexPage() {
  const posts = getBlogPosts();

  return (
    <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-navy-900 mb-4">FBAR Filing Blog</h1>
        <p className="text-xl text-gray-600 mb-12">
          Expert guides on FBAR requirements, deadlines, and compliance.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-500">Articles coming soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.slug} className="border-b border-gray-200 pb-8">
                <Link href={`/blog/${post.slug}`} className="group">
                  <h2 className="text-2xl font-semibold text-navy-900 group-hover:text-blue-700 mb-2">
                    {post.title}
                  </h2>
                  <p className="text-gray-600 mb-2">{post.description}</p>
                  <p className="text-sm text-gray-400">
                    {post.author} · {new Date(post.publishedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
