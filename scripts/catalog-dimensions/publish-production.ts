/**
 * Publish reviewed sketches after their assets have deployed to the canonical site.
 * DATABASE_URL must be supplied by the caller and target the guarded production DB.
 * Dry run: node --import tsx scripts/catalog-dimensions/publish-production.ts --target production
 * Apply:   node --import tsx scripts/catalog-dimensions/publish-production.ts --target production --apply
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogTypeHash, parseCatalogTypeArgs } from '../reclassify-atehna-catalog';
import {
  synchronizeReviewedDimensionSketches,
  validateDimensionSketchManifest,
  type DimensionSketchManifest,
  type DimensionSketchState
} from './sync';

export const PRODUCTION_DIMENSION_MANIFEST = 'data/catalog/dimension-sketches-production-2026-09.json';

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Stored IDs are evidence only: every binding is resolved by current slug and SKU. */
export function bindReviewedProductionManifest(manifest: DimensionSketchManifest, state: DimensionSketchState): DimensionSketchManifest {
  const productNames = (manifest as DimensionSketchManifest & { productNames?: Record<string, string> }).productNames;
  ensure(productNames, 'The reviewed production product names are required.');
  const result = structuredClone(manifest);
  for (const product of result.products) {
    const items = state.items.filter(item => item.slug === product.slug);
    ensure(items.length === 1 && items[0].status !== 'deleted', 'Missing, archived or ambiguous production product: ' + product.slug);
    const item = items[0];
    ensure(item.item_name === productNames[product.slug], 'Product title changed after sketch review: ' + product.slug);
    const variants = state.variants.filter(variant => String(variant.item_id) === String(item.id));
    ensure(variants.length === product.variantSnapshot.length, 'Production variant set changed after review: ' + product.slug);
    const bySku = new Map<string, string>();
    product.itemId = String(item.id);
    product.variantSnapshot = product.variantSnapshot.map(snapshot => {
      const matches = variants.filter(variant => variant.variant_sku === snapshot.variantSku);
      ensure(matches.length === 1 && !bySku.has(snapshot.variantSku), 'Missing or ambiguous production SKU: ' + snapshot.variantSku);
      const variant = matches[0];
      const measurement = (value: unknown) => value === null || value === undefined ? null : Number(value);
      const current = {
        variantSku: String(variant.variant_sku), variantName: String(variant.variant_name),
        length: measurement(variant.length), width: measurement(variant.width), thickness: measurement(variant.thickness),
        contentOverride: variant.content_override_json ?? null, optionLabels: variant.dimension_option_labels ?? {}
      };
      const reviewed = {
        variantSku: snapshot.variantSku, variantName: snapshot.variantName,
        length: snapshot.length, width: snapshot.width, thickness: snapshot.thickness,
        contentOverride: snapshot.contentOverride, optionLabels: snapshot.optionLabels ?? {}
      };
      ensure(catalogTypeHash(current) === catalogTypeHash(reviewed),
        'Production labels, geometry or specifications changed after review: ' + product.slug + '/' + snapshot.variantSku);
      const resolvedId = String(variant.id);
      bySku.set(snapshot.variantSku, resolvedId);
      return { ...snapshot, id: resolvedId };
    });
    product.images = product.images.map(image => ({
      ...image,
      variantIds: image.variantSkus.map(sku => {
        const resolvedId = bySku.get(sku);
        ensure(resolvedId, 'Sketch SKU is outside its reviewed product: ' + product.slug + '/' + sku);
        return resolvedId;
      })
    }));
  }
  return validateDimensionSketchManifest(result);
}

export async function publishProductionDimensionSketches(args = process.argv.slice(2)) {
  const options = parseCatalogTypeArgs(args);
  ensure(options.target === 'production', 'This publisher accepts only the explicit production target.');
  return synchronizeReviewedDimensionSketches({
    ...options, manifestPath: PRODUCTION_DIMENSION_MANIFEST, bindManifest: bindReviewedProductionManifest
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  publishProductionDimensionSketches().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
