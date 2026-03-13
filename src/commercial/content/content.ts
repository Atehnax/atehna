import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export type PageContent = {
  slug: string;
  title: string;
  description?: string;
  content: string;
};

export type CategoryContent = {
  slug: string;
  title: string;
  summary: string;
  image: string;
  items: Array<{
    sku: string;
    name: string;
    unit?: string;
    image?: string;
    unitPrice?: number | null;
  }>;
  content: string;
};

const contentRoot = path.join(process.cwd(), 'content');

function readMdxFile(folder: string, slug: string) {
  const filePath = path.join(contentRoot, folder, `${slug}.mdx`);
  const file = fs.readFileSync(filePath, 'utf8');
  return matter(file);
}

export function getPageContent(slug: string): PageContent {
  const { data, content } = readMdxFile('pages', slug);
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    content
  };
}

export function getCategorySlugs(): string[] {
  const dir = path.join(contentRoot, 'categories');
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => name.replace(/\.mdx$/, ''));
}

export function getCategoryContent(slug: string): CategoryContent {
  const { data, content } = readMdxFile('categories', slug);
  return {
    slug,
    title: data.title ?? slug,
    summary: data.summary ?? '',
    image: data.image ?? '',
    items: data.items ?? [],
    content
  };
}

export function getAllCategories(): CategoryContent[] {
  return getCategorySlugs().map((slug) => getCategoryContent(slug));
}
