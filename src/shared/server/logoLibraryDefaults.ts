import 'server-only';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LOGO_PLACEMENT_IDS, LOGO_PLACEMENT_LABELS, type LogoLibrary, type LogoSourceAsset, type LogoProject, type LogoPublishedRevision } from '@/shared/domain/logo/logoLibrary';
import { createLogoPublication, imageLogoProject, storeLogoSource } from './logoLibraryStorage';

type InitialLogoStorage = {
  saveSource: (name: string, bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType']) => Promise<LogoSourceAsset>;
  publish: (project: LogoProject, assets: LogoSourceAsset[]) => Promise<LogoPublishedRevision>;
};

/** Fresh installations start with the existing artwork and intentional PDF crop. */
export async function createInitialLogoLibrary(storage: InitialLogoStorage = {
  saveSource: storeLogoSource, publish: createLogoPublication
}): Promise<LogoLibrary> {
  const sourceBytes = [
    await readFile(join(process.cwd(), 'src/shared/server/logo-defaults/standalone.png')),
    await readFile(join(process.cwd(), 'src/shared/server/logo-defaults/pdf-document.png'))
  ];
  const now = new Date().toISOString();
  const library: LogoLibrary = {
    version: 1, revision: 1, assets: [], variants: [], migratedAt: now,
    placements: Object.fromEntries(LOGO_PLACEMENT_IDS.map(purpose => [purpose, {
      variantId: null, fallback: purpose.startsWith('footer-') ? 'original' : 'brand'
    }])) as LogoLibrary['placements']
  };
  for (const [index, purpose] of (['standalone', 'pdf-document'] as const).entries()) {
    const asset = await storage.saveSource(LOGO_PLACEMENT_LABELS[purpose] + ' · ohranjen videz.png', sourceBytes[index], 'image/png');
    library.assets.push(asset);
    const project = imageLogoProject(asset);
    project.layers[0].name = 'Ohranjen videz logotipa';
    const published = await storage.publish(project, library.assets);
    const variantId = randomUUID();
    library.variants.push({ id: variantId, name: LOGO_PLACEMENT_LABELS[purpose], draft: project, draftRevision: 1, updatedAt: now, published, history: [] });
    library.placements[purpose] = { variantId, fallback: 'none' };
  }
  return library;
}
