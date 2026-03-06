import fs from 'fs';
import path from 'path';
import { siteConfig } from '@/lib/site-config';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category?: string;
  image?: string;
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'));

  const posts = files
    .map(filename => {
      const slug = filename.replace('.mdx', '');
      const filePath = path.join(BLOG_DIR, filename);
      const content = fs.readFileSync(filePath, 'utf-8');

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      const frontmatter = frontmatterMatch[1];
      const meta: Record<string, string> = {};
      frontmatter.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          meta[key.trim()] = valueParts
            .join(':')
            .trim()
            .replace(/^["']|["']$/g, '');
        }
      });

      return {
        slug,
        title: meta.title || slug,
        description: meta.description || '',
        date: meta.date || '',
        author: meta.author || siteConfig.owner,
        category: meta.category,
        image: meta.image,
      } as BlogPost;
    })
    .filter(Boolean) as BlogPost[];

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const posts = getAllPosts();
  return posts.find(p => p.slug === slug) || null;
}
