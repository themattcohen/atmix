import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import sanitizeHtml from 'sanitize-html';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

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
  const posts = files
    .map((file) => {
      const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
      const { data } = matter(content);
      return { slug: file.replace('.mdx', ''), ...data } as BlogPost;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
    );

  if (process.env.NODE_ENV === 'production') {
    const now = new Date();
    return posts.filter((p) => new Date(p.publishedDate) <= now);
  }
  return posts;
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdown);
  // Sanitize after HTML conversion to prevent XSS
  return sanitizeHtml(String(result), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
    },
  });
}

export function getBlogPost(
  slug: string
): { meta: BlogPost; content: string } | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { meta: { slug, ...data } as BlogPost, content };
}
