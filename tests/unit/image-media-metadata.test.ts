import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  formatImagePixelDimensions,
  formatImageVariantAssignmentLabel,
  inferImageFormatLabel,
  normalizeImagePixelDimensions,
  remapImageSlotAssignmentsAfterMove,
  remapMovedImageSlotIndex
} from '../../src/admin/features/artikli/lib/imageMediaMetadata';

function readArticleEditorSource(): string {
  return readFileSync(
    path.join(process.cwd(), 'src/admin/features/artikli/components/AdminItemEditorPage.tsx'),
    'utf8'
  );
}

function readImageMediaTableSource(source: string): string {
  const tableStart = source.indexOf('<table aria-label="Podatki o slikah"');
  const tableEnd = source.indexOf('</table>', tableStart);
  assert.ok(tableStart >= 0, 'the image media table should have an accessible name');
  assert.ok(tableEnd > tableStart, 'the image media table should be complete');
  return source.slice(tableStart, tableEnd);
}

test('image media labels prefer the real MIME format and support common fallbacks', () => {
  assert.equal(
    inferImageFormatLabel({ mimeType: 'image/jpeg; charset=binary', fileName: 'photo.png' }),
    'JPG'
  );
  assert.equal(inferImageFormatLabel({ fileName: 'photo.jpeg' }), 'JPG');
  assert.equal(inferImageFormatLabel({ fileName: 'render.webp' }), 'WEBP');
  assert.equal(
    inferImageFormatLabel({ url: 'https://blob.example/catalog/image.avif?download=1#preview' }),
    'AVIF'
  );
  assert.equal(inferImageFormatLabel({ fileName: 'not-an-image.exe' }), '—');
  assert.equal(inferImageFormatLabel({ url: 'https://blob.example/catalog/image' }), '—');
});

test('image media dimensions are normalized and explicitly formatted as pixels', () => {
  assert.deepEqual(normalizeImagePixelDimensions({ width: 1200, height: 900 }), {
    width: 1200,
    height: 900
  });
  assert.equal(formatImagePixelDimensions({ width: 1200, height: 900 }), '1200 × 900 px');
  assert.equal(normalizeImagePixelDimensions({ width: 0, height: 900 }), null);
  assert.equal(normalizeImagePixelDimensions({ width: 10.5, height: 20 }), null);
  assert.equal(formatImagePixelDimensions(null), '—');
});

test('variant assignment labels show names without appending SKU', () => {
  assert.equal(
    formatImageVariantAssignmentLabel({ label: '0,5 × 100 × 100 mm', sku: 'MAT-100' }, 0),
    '0,5 × 100 × 100 mm'
  );
  assert.equal(
    formatImageVariantAssignmentLabel({ label: '0,5 × 100 × 100 mm', sku: '  ' }, 0),
    '0,5 × 100 × 100 mm'
  );
  assert.equal(
    formatImageVariantAssignmentLabel({ label: ' ', sku: '' }, 2),
    'Različica 3'
  );
});

test('dimensional image assignments use actual dimensions while standard assignments retain descriptive names', () => {
  const variant = { label: 'Bela plošča', sku: 'MAT-100', thickness: 0.5, length: 300, width: 200 };
  assert.equal(formatImageVariantAssignmentLabel(variant, 0, true), '0,5 × 300 × 200 mm');
  assert.equal(formatImageVariantAssignmentLabel(variant, 0, false), 'Bela plošča');
  assert.equal(formatImageVariantAssignmentLabel({ label: 'MAT-100', sku: 'MAT-100' }, 2), 'Različica 3');
  assert.equal(formatImageVariantAssignmentLabel({ label: 'Bela', thickness: null, length: 0, width: Number.NaN }, 0, true), 'Bela');
});

test('moving an image remaps every affected assignment for forward and backward moves', () => {
  assert.deepEqual(
    remapImageSlotAssignmentsAfterMove([0, 1, 2, 4], 0, 2),
    [2, 0, 1, 4]
  );
  assert.deepEqual(
    remapImageSlotAssignmentsAfterMove([0, 1, 2, 4], 2, 0),
    [1, 2, 0, 4]
  );
  assert.equal(remapMovedImageSlotIndex(3, 0, 2), 3);
  assert.equal(remapMovedImageSlotIndex(1, 1, 1), 1);
});

test('article media table renders one row per uploaded image and always exposes file metadata', () => {
  const source = readArticleEditorSource();
  const tableSource = readImageMediaTableSource(source);

  assert.match(tableSource, />Slika<\/th>/u);
  assert.match(tableSource, />Format<\/th>/u);
  assert.match(tableSource, />Dimenzije<\/th>/u);
  assert.match(tableSource, /mediaImageSlots\.map\(\(slot, slotIndex\) =>/u);
  assert.doesNotMatch(tableSource, /draft\.variants\.map\(/u);
  assert.match(tableSource, /inferImageFormatLabel\(\{[\s\S]*?mimeType: slot\.mimeType/u);
  assert.match(tableSource, /formatImagePixelDimensions\(slot\.imageDimensions\)/u);
  assert.doesNotMatch(tableSource, /variantTypeLabel|variantDimensionLabel|Plošča|Po masi/u);
});

test('variant assignment stays optional, uses existing variants, and does not ask for an image SKU', () => {
  const source = readArticleEditorSource();
  const tableSource = readImageMediaTableSource(source);
  const assignmentSourceStart = source.indexOf('const addImageVariantAssignment');
  const assignmentSourceEnd = source.indexOf('const updateImageAltText', assignmentSourceStart);
  const assignmentSource = source.slice(assignmentSourceStart, assignmentSourceEnd);

  assert.match(tableSource, />Različice<\/th>/u);
  assert.match(tableSource, /Vse različice/u);
  assert.match(tableSource, /Dodaj različico …/u);
  assert.match(tableSource, /Vse različice \(splošna slika\)/u);
  assert.match(tableSource, /availableVariants\.map\(\(\{ variant, selectionLabel \}\)/u);
  assert.match(tableSource, /formatImageVariantAssignmentLabel\(variant, variantIndex, isDimensionBasedMode\)/u);
  assert.doesNotMatch(tableSource, />SKU<\/th>|<input|type=["']text["']/u);
  assert.match(assignmentSource, /const nextAssignments = \[\.\.\.assignments, slotIndex\]/u);
  assert.match(assignmentSource, /clearImageVariantAssignments/u);
});

test('article image metadata is persisted and measured without a second image request', () => {
  const source = readArticleEditorSource();

  assert.match(source, /imageDimensions: normalizeImagePixelDimensions\(media\.imageDimensions\)/u);
  assert.match(source, /imageDimensions: entry\.imageDimensions/u);
  assert.match(source, /image\.naturalWidth[\s\S]*?image\.naturalHeight/u);
  assert.doesNotMatch(source, /new window\.Image\(\)/u);
  assert.match(source, /remapImageSlotAssignmentsAfterMove\([\s\S]*?variant\.imageAssignments/u);
});
