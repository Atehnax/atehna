import { MetadataRoute } from 'next';
import { getCategorySlugs } from '@/lib/content';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://atehna.si';
  const categoryRoutes = getCategorySlugs().map((slug) => ({
    url: `${baseUrl}/products/${slug}`,
    lastModified: new Date()
  }));

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/products`, lastModified: new Date() },
    { url: `${baseUrl}/how-schools-order`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
    { url: `${baseUrl}/privacy`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/cookies`, lastModified: new Date() },
    ...categoryRoutes
  ];
}
