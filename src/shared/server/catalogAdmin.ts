import fs from 'fs/promises';
import path from 'path';
import type { CatalogCategory } from '@/commercial/catalog/catalog';

type CatalogData = { categories: CatalogCategory[] };

const catalogPath = path.join(process.cwd(), 'src/commercial/content/data/catalog.json');

export async function readCatalogFile(): Promise<CatalogData> {
  const raw = await fs.readFile(catalogPath, 'utf8');
  return JSON.parse(raw) as CatalogData;
}

export async function writeCatalogFile(data: CatalogData): Promise<void> {
  const nextPayload = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = `${catalogPath}.tmp`;
  await fs.writeFile(tempPath, nextPayload, 'utf8');
  await fs.rename(tempPath, catalogPath);
}
