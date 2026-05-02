import { MetadataRoute } from 'next';
import { getCatalogCategorySlugsServer } from '@/commercial/catalog/catalogServer';
import { hasDatabaseConnectionString } from '@/shared/server/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://atehna.si';
  const categoryRoutes = hasDatabaseConnectionString()
    ? (await getCatalogCategorySlugsServer()).map((slug) => ({
        url: `${baseUrl}/products/${slug}`,
        lastModified: new Date()
      }))
    : [];

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/products`, lastModified: new Date() },
    { url: `${baseUrl}/how-schools-order`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
    { url: `${baseUrl}/order`, lastModified: new Date() },
    { url: `${baseUrl}/privacy`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/cookies`, lastModified: new Date() },
    ...categoryRoutes
  ];
}
