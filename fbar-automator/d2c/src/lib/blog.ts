import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import sanitizeHtml from 'sanitize-html';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedDate: string;
  author: string;
  heroImage?: string;
}

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export function getBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
      const { data } = matter(content);
      return { slug: file.replace('.mdx', ''), ...data } as BlogPost;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
    );
}

export function getBlogPost(
  slug: string
): { meta: BlogPost; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  // Sanitize content to prevent XSS — strips script tags, event handlers, etc.
  const sanitizedContent = sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
    },
  });
  return { meta: { slug, ...data } as BlogPost, content: sanitizedContent };
}
