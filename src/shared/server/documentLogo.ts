import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLogoLibrary } from '@/shared/server/logoLibrary';
import { publishedLogoProjection } from '@/shared/server/logoLibraryOperations';
import { readLogoPublishedOutput } from '@/shared/server/logoLibraryStorage';
import { renderLogoProject } from '@/shared/server/logoLibraryRender';

/** Published PNG only. Drafts and source SVGs never enter generated customer documents. */
export async function getDocumentLogoArtwork(): Promise<Uint8Array | null> {
  const library = await getLogoLibrary();
  const logo = publishedLogoProjection(library).placements['pdf-document'];
  if (!logo) return null;
  if (logo.variantId) {
    const revision = library.variants.find(v => v.id === logo.variantId)?.published;
    if (!revision) throw new Error('Objavljeni logotip za dokumente ni na voljo.');
    return readLogoPublishedOutput(revision.png2x);
  }
  if (logo.fallback === 'brand') {
    return (await renderLogoProject({ version: 1, canvas: { width: 240, height: 64 }, layers: [{
      id: 'brand', name: 'Atehna', type: 'text', x: 0, y: 0, width: 240, height: 64,
      rotation: 0, opacity: 1, visible: true, locked: false, text: 'Atehna', fontFamily: 'Inter', fontSize: 52,
      fontWeight: 700, fontStyle: 'normal', fill: '#0F172A', textAlign: 'left', lineHeight: 1, letterSpacing: -1
    }] }, [], async () => { throw new Error('Izvorna slika ni na voljo.'); })).png2x;
  }
  return readFile(path.join(process.cwd(), 'public', 'brand', 'atehna-document-wordmark.png'));
}
