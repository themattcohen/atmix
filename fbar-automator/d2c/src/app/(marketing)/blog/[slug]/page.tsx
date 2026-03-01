import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBlogPost, getBlogPosts, renderMarkdownToHtml } from '@/lib/blog';
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
      ...(post.meta.heroImage && {
        images: [{ url: post.meta.heroImage, width: 1200, height: 630, alt: post.meta.title }],
      }),
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

  const htmlContent = await renderMarkdownToHtml(post.content);

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
            ...(post.meta.heroImage && { image: `https://fbardirect.com${post.meta.heroImage}` }),
            author: {
              '@type': 'Person',
              name: post.meta.author,
              jobTitle: 'CPA',
              affiliation: {
                '@type': 'Organization',
                name: 'FBAR Direct',
                url: 'https://fbardirect.com',
              },
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
            <time dateTime={post.meta.publishedDate}>
              {new Date(post.meta.publishedDate + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>
        </header>

        <div className="mb-8 border-l-4 border-amber-400 bg-amber-50 p-4 rounded-r-lg">
          <p className="text-sm text-amber-900 italic">
            FBAR Direct prepares and files your FBAR (FinCEN Form 114) on your behalf. You are responsible for reviewing all information for accuracy before submission to FinCEN. This article is for informational purposes only and does not constitute tax, legal, or financial advice.
          </p>
        </div>

        {post.meta.heroImage && (
          <div className="mb-8 rounded-lg overflow-hidden">
            <img
              src={post.meta.heroImage}
              alt={post.meta.title}
              width={1200}
              height={630}
              className="w-full h-auto"
            />
          </div>
        )}

        <div className="prose prose-gray max-w-none">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500 italic">
            The information in this article is current as of{' '}
            {new Date(post.meta.publishedDate + 'T00:00:00').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            . Tax regulations change frequently. Always verify current requirements at{' '}
            <a href="https://www.irs.gov" className="underline hover:text-gray-700" target="_blank" rel="noopener noreferrer">IRS.gov</a>
            {' '}or{' '}
            <a href="https://www.fincen.gov" className="underline hover:text-gray-700" target="_blank" rel="noopener noreferrer">FinCEN.gov</a>
            . For advice specific to your situation, consult a qualified tax professional.
          </p>
        </div>

        <div className="mt-16 p-6 bg-navy-50 rounded-lg text-center">
          <p className="text-lg font-semibold text-navy-900 mb-2">Ready to file your FBAR?</p>
          <p className="text-gray-600 mb-4">Let FBAR Direct prepare your filing — you review and approve before we submit to FinCEN.</p>
          <Link
            href="/threshold"
            className="inline-block px-6 py-3 bg-gold-500 text-navy-900 rounded-md font-bold hover:bg-gold-600 transition-colors"
          >
            Start Your Filing
          </Link>
        </div>
      </div>
    </article>
  );
}
