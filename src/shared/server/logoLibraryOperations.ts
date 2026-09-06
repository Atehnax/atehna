import {
  blankLogoProject, LOGO_PLACEMENT_IDS, logoVariantUsages,
  type LogoLibrary, type LogoLibraryAction, type LogoPublishedRevision, type PublishedLogoAsset, type PublishedSiteLogoConfig,
  type LogoAssignment, type LogoPlacementId
} from '@/shared/domain/logo/logoLibrary';
import { validateLogoProject } from '@/shared/domain/logo/logoProject';

export class LogoLibraryError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'LogoLibraryError'; }
}
export const LOGO_LIBRARY_MAX_VARIANTS = 64;
export const LOGO_LIBRARY_MAX_ASSETS = 128;
export const LOGO_LIBRARY_HISTORY_LIMIT = 20;
// Leave room for the published projection inside Vercel's response budget.
export const LOGO_LIBRARY_MAX_JSON_BYTES = 3_500_000;

export function requireLogoRevision(actual: number, expected: unknown) {
  if (!Number.isSafeInteger(expected) || expected !== actual) {
    throw new LogoLibraryError('Različica se je medtem spremenila. Osvežite knjižnico in ohranite svoje neshranjene spremembe.', 409);
  }
}
function cleanName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120 || /[\u0000-\u001f]/u.test(value)) {
    throw new LogoLibraryError('Vnesite ime različice z največ 120 znaki.');
  }
  return value.trim();
}
function assignment(value: unknown, library: LogoLibrary): LogoAssignment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LogoLibraryError('Uporaba logotipa ni veljavna.');
  const row = value as Partial<LogoAssignment>;
  if (!['default', 'original', 'brand', 'none'].includes(row.fallback ?? '')) throw new LogoLibraryError('Nadomestni logotip ni veljaven.');
  if (row.variantId !== null && typeof row.variantId !== 'string') throw new LogoLibraryError('Različica za mesto uporabe ni veljavna.');
  if (row.variantId && !library.variants.find(variant => variant.id === row.variantId)?.published) {
    throw new LogoLibraryError('Mestu uporabe lahko dodelite le objavljeno različico.');
  }
  return { variantId: row.variantId!, fallback: row.fallback! };
}

type Mutation = Exclude<LogoLibraryAction, { action: 'preview' | 'export' }>;
export function applyLogoLibraryAction(
  current: LogoLibrary, input: Mutation,
  context: { id: string; now: string; publication?: LogoPublishedRevision }
): { library: LogoLibrary; publicChanged: boolean } {
  requireLogoRevision(current.revision, input.expectedRevision);
  const library = structuredClone(current);
  let publicChanged = false;
  const variant = 'variantId' in input ? library.variants.find(value => value.id === input.variantId) : undefined;
  if ('variantId' in input && !variant) throw new LogoLibraryError('Različica ne obstaja.', 404);
  switch (input.action) {
    case 'create':
      if (library.variants.length >= LOGO_LIBRARY_MAX_VARIANTS) throw new LogoLibraryError('Knjižnica že vsebuje največje dovoljeno število različic.');
      library.variants.push({ id: context.id, name: cleanName(input.name), draft: validateLogoProject(input.project ?? blankLogoProject(), library.assets), draftRevision: 1, updatedAt: context.now, published: null, history: [] });
      break;
    case 'save':
      requireLogoRevision(variant!.draftRevision, input.expectedDraftRevision);
      variant!.draft = validateLogoProject(input.project, library.assets);
      variant!.name = cleanName(input.name);
      variant!.draftRevision += 1;
      variant!.updatedAt = context.now;
      break;
    case 'duplicate':
      if (library.variants.length >= LOGO_LIBRARY_MAX_VARIANTS) throw new LogoLibraryError('Knjižnica že vsebuje največje dovoljeno število različic.');
      library.variants.push({ id: context.id, name: cleanName(input.name), draft: structuredClone(variant!.draft), draftRevision: 1, updatedAt: context.now, published: null, history: [] });
      break;
    case 'rename':
      variant!.name = cleanName(input.name); variant!.updatedAt = context.now;
      publicChanged = Boolean(variant!.published);
      break;
    case 'delete':
      if (logoVariantUsages(library, variant!.id).length) throw new LogoLibraryError('Različica je v uporabi. Najprej prerazporedite njena mesta uporabe.', 409);
      library.variants = library.variants.filter(value => value.id !== variant!.id);
      break;
    case 'assign': {
      if (!input.placements || typeof input.placements !== 'object' || Array.isArray(input.placements) || !Object.keys(input.placements).length) {
        throw new LogoLibraryError('Izberite vsaj eno mesto uporabe.');
      }
      for (const [purpose, value] of Object.entries(input.placements)) {
        if (!(LOGO_PLACEMENT_IDS as readonly string[]).includes(purpose)) throw new LogoLibraryError('Mesto uporabe ne obstaja.');
        library.placements[purpose as LogoPlacementId] = assignment(value, library);
      }
      publicChanged = true;
      break;
    }
    case 'publish':
      requireLogoRevision(variant!.draftRevision, input.expectedDraftRevision);
      if (!context.publication || JSON.stringify(context.publication.project) !== JSON.stringify(variant!.draft)) {
        throw new LogoLibraryError('Objava se ne ujema s shranjenim osnutkom.', 409);
      }
      if (variant!.published) variant!.history.unshift(variant!.published);
      variant!.history = variant!.history.slice(0, LOGO_LIBRARY_HISTORY_LIMIT);
      variant!.published = structuredClone(context.publication);
      variant!.updatedAt = context.now; publicChanged = true;
      break;
    case 'restore': {
      const restored = variant!.history.find(revision => revision.id === input.revisionId);
      if (!restored) throw new LogoLibraryError('Prejšnja objava ne obstaja.', 404);
      variant!.history = [variant!.published, ...variant!.history.filter(revision => revision.id !== restored.id)]
        .filter((revision): revision is LogoPublishedRevision => revision !== null).slice(0, LOGO_LIBRARY_HISTORY_LIMIT);
      variant!.published = structuredClone(restored);
      variant!.draft = structuredClone(restored.project);
      variant!.draftRevision += 1; variant!.updatedAt = context.now; publicChanged = true;
      break;
    }
    default:
      throw new LogoLibraryError('Dejanje knjižnice ni veljavno.');
  }
  library.revision += 1;
  if (new TextEncoder().encode(JSON.stringify(library)).byteLength > LOGO_LIBRARY_MAX_JSON_BYTES) {
    throw new LogoLibraryError('Knjižnica presega dovoljeno velikost. Odstranite neuporabljene različice.');
  }
  return { library, publicChanged };
}

const original = (): PublishedLogoAsset => ({
  variantId: null, name: 'Atehna · izvirnik', revision: 'original-v1',
  pngUrl: '/brand/atehna-document-wordmark.png', svgUrl: null, width: 1873, height: 840,
  bounds: { x: 0, y: 0, width: 1873, height: 840 }, fallback: 'original'
});
const brand = (): PublishedLogoAsset => ({
  variantId: null, name: 'Atehna', revision: 'brand-v1', pngUrl: '', svgUrl: null,
  width: 130, height: 30, bounds: { x: 0, y: 0, width: 130, height: 30 }, fallback: 'brand'
});
export function publishedLogoProjection(library: LogoLibrary): PublishedSiteLogoConfig {
  const resolve = (purpose: LogoPlacementId): PublishedLogoAsset | null => {
    const selected = library.placements[purpose];
    const variant = selected.variantId ? library.variants.find(value => value.id === selected.variantId) : undefined;
    if (variant?.published) {
      const revision = variant.published;
      return { variantId: variant.id, name: variant.name, revision: revision.id, pngUrl: revision.png.url,
        svgUrl: revision.svg.url, width: revision.png.width, height: revision.png.height, bounds: structuredClone(revision.bounds) };
    }
    if (selected.fallback === 'default' && purpose !== 'standalone') return resolve('standalone');
    if (selected.fallback === 'none') return null;
    return selected.fallback === 'brand' ? brand() : original();
  };
  return { revision: library.revision, placements: Object.fromEntries(LOGO_PLACEMENT_IDS.map(purpose => [purpose, resolve(purpose)])) as PublishedSiteLogoConfig['placements'] };
}
