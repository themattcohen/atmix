import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';
import { getAllPosts, getPostBySlug } from '@/lib/blog';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
  };
}

export default async function BlogPost({ params }: Props) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  let Content;
  try {
    Content = (await import(`../../../../content/blog/${params.slug}.mdx`))
      .default;
  } catch {
    notFound();
  }

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          author: { '@type': 'Person', name: post.author },
          publisher: { '@type': 'Organization', name: siteConfig.name },
          datePublished: post.date,
          url: `${siteConfig.url}/blog/${post.slug}`,
        }}
      />
      <article className="section-padding">
        <div className="container-content max-w-3xl">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Blog', href: '/blog' },
              { label: post.title },
            ]}
          />
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-alpine-blue mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-text-secondary text-sm">
              <span>{post.author}</span>
              <span>&middot;</span>
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
              {post.category && (
                <>
                  <span>&middot;</span>
                  <span className="text-alpine-teal">{post.category}</span>
                </>
              )}
            </div>
          </header>
          <div className="prose prose-lg max-w-none prose-headings:font-heading prose-headings:text-alpine-blue prose-a:text-alpine-teal">
            <Content />
          </div>
        </div>
      </article>
      <CallToAction />
    </>
  );
}
