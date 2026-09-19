/** Reviewed photo identities shared by the removal phase and repeatable imports. */
import type { CatalogItemEditorPayload, CatalogItemMediaPayload } from '../src/shared/domain/catalog/catalogAdminTypes';

export type RejectedPhotoIdentity = { slug: string; blobUrl: string; target?: 'local' | 'production' };
export type RejectedPhotoPolicy = {
  removals: RejectedPhotoIdentity[];
  replacements: Array<RejectedPhotoIdentity & { fromBlobUrl: string }>;
};
type MediaLike = Record<string, unknown> | CatalogItemMediaPayload;

/** Conservative protection includes unclassified legacy schematics and hidden technical images. */
export function isProtectedTechnicalImage(media: MediaLike): boolean {
  const row = media as Record<string, unknown>;
  const classification = String(row.image_type ?? row.imageType ?? '');
  const source = String(row.blob_url ?? row.blobUrl ?? row.external_url ?? row.externalUrl ?? row.filename ?? '');
  const caption = String(row.alt_text ?? row.altText ?? '');
  return /diagram|schem|technical|drawing|dimension|sketch|blueprint/iu.test(classification)
    || /\.svg(?:$|[?#])/iu.test(source)
    || /(?:^|[\/_.-])(?:dimenzij[^\/_.]*|shema|skica|diagram|schematic|technical|drawing|blueprint)(?:[\/_.-]|$)/iu.test(source)
    || /\b(?:shema|shematsk\p{L}*|tehnična risba|tehnicna risba|technical drawing|dimension diagram|merska skica)\b/iu.test(caption);
}

export function rejectedPhotoIdentities(policy: RejectedPhotoPolicy, target?: 'local' | 'production'): RejectedPhotoIdentity[] {
  const selected = [...policy.removals, ...policy.replacements.map(entry => ({ ...entry, blobUrl: entry.fromBlobUrl }))]
    .filter(entry => !target || !entry.target || entry.target === target);
  return [...new Map(selected.map(entry => [`${entry.slug}\n${entry.blobUrl}`, entry])).values()];
}

/** Assignment indexes refer to the visible gallery in canonical/import payloads. */
export function removeRejectedPayloadMedia<T extends CatalogItemEditorPayload>(product: T, rejected: RejectedPhotoIdentity[]): T {
  const urls = new Set(rejected.filter(entry => entry.slug === product.slug).map(entry => entry.blobUrl));
  if (!urls.size) return structuredClone(product);
  const isGallery = (row: CatalogItemMediaPayload) => row.mediaKind === 'image' && row.role === 'gallery';
  const shouldRemove = (row: CatalogItemMediaPayload) => {
    if (!urls.has(row.blobUrl || row.externalUrl || '')) return false;
    if (!isGallery(row)) throw new Error(`Rejected identity is not a gallery image: ${product.slug}/${row.blobUrl}`);
    if (isProtectedTechnicalImage(row)) throw new Error(`Refusing to remove technical image: ${product.slug}/${row.blobUrl}`);
    return true;
  };
  const output = structuredClone(product);
  const oldVisible = product.media.filter(row => isGallery(row) && !row.hidden);
  const removed = new Set(product.media.filter(shouldRemove));
  const remainingVisible = oldVisible.filter(row => !removed.has(row));
  output.media = product.media.filter(row => !removed.has(row)).map(row => structuredClone(row));
  output.variants = product.variants.map(variant => ({ ...structuredClone(variant),
    ...(variant.imageAssignments === undefined ? {} : { imageAssignments: variant.imageAssignments.flatMap(index => {
      const row = oldVisible[index];
      const next = row ? remainingVisible.indexOf(row) : -1;
      return next < 0 ? [] : [next];
    }) })
  }));
  const withAliases = output as T & { mediaSourceAliases?: Array<{ localBlobUrl: string }> };
  if (withAliases.mediaSourceAliases) withAliases.mediaSourceAliases = withAliases.mediaSourceAliases.filter(alias => output.media.some(row => row.blobUrl === alias.localBlobUrl));
  return output;
}
