import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogPosts } from '@/lib/blog';
import { JsonLd } from '@/components/JsonLd';
import Link from 'next/link';

export function generateStaticParams() {
  return getBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: 'article',
      publishedTime: post.meta.publishedDate,
      authors: [post.meta.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <article className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.meta.title,
            description: post.meta.description,
            datePublished: post.meta.publishedDate,
            author: {
              '@type': 'Person',
              name: post.meta.author,
            },
            publisher: {
              '@type': 'Organization',
              name: 'FBAR Direct',
              url: 'https://fbardirect.com',
            },
          }}
        />

        <header className="mb-12">
          <Link href="/blog" className="text-sm text-blue-700 hover:underline mb-4 inline-block">
            &larr; Back to Blog
          </Link>
          <h1 className="text-4xl font-bold text-navy-900 mb-4">{post.meta.title}</h1>
          <p className="text-gray-500">
            {post.meta.author} ·{' '}
            {new Date(post.meta.publishedDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </header>

        <div className="prose prose-gray max-w-none">
          {/* MDX content will be rendered here in the future */}
          {/* For now, display raw content */}
          {/* Content is sanitized in lib/blog.ts via sanitize-html */}
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>

        <div className="mt-16 p-6 bg-navy-50 rounded-lg text-center">
          <p className="text-lg font-semibold text-navy-900 mb-2">Ready to file your FBAR?</p>
          <p className="text-gray-600 mb-4">Most people finish in under 10 minutes.</p>
          <Link
            href="/threshold"
            className="inline-block px-6 py-3 bg-gold-500 text-navy-900 rounded-md font-bold hover:bg-gold-600 transition-colors"
          >
            Start Filing Now
          </Link>
        </div>
      </div>
    </article>
  );
}
