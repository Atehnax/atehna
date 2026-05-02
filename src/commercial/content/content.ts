import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

type PageContent = {
  slug: string;
  title: string;
  description?: string;
  content: string;
};

const contentRoot = path.join(process.cwd(), 'src/commercial/content/data');

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
