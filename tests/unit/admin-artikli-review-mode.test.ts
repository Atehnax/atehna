import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ADMIN_ARTICLE_REVIEW_MARKERS_STORAGE_KEY,
  parseAdminArticleReviewMarkers,
  serializeAdminArticleReviewMarkers,
  setAdminArticleReviewMarker
} from '../../src/admin/features/artikli/lib/articleReviewMarkers';
import { getOrderEmailEventStatusPresentation } from '../../src/admin/features/email/emailEventStatusPresentation';
import { adminTableRowToneClasses } from '../../src/shared/ui/theme/tokens';

const managerSource = readFileSync(
  new URL('../../src/admin/features/artikli/components/AdminItemsManager.tsx', import.meta.url),
  'utf8'
);
const numberFieldSource = readFileSync(
  new URL('../../src/admin/features/artikli/components/ArticleTableNumber.tsx', import.meta.url),
  'utf8'
);
const fieldStyles = readFileSync(
  new URL('../../src/admin/features/artikli/components/ArticleListFields.module.css', import.meta.url),
  'utf8'
);

test('article review markers parse defensively and serialize deterministically', () => {
  assert.deepEqual(Array.from(parseAdminArticleReviewMarkers(null)), []);
  assert.deepEqual(Array.from(parseAdminArticleReviewMarkers('{broken')), []);
  assert.deepEqual(Array.from(parseAdminArticleReviewMarkers('{"id":true}')), []);
  assert.deepEqual(
    Array.from(parseAdminArticleReviewMarkers('["family-b", "", 3, "family-a", "family-b"]')),
    ['family-b', 'family-a']
  );

  const original = new Set(['family-b']);
  const marked = setAdminArticleReviewMarker(original, 'family-a', true);
  const unmarked = setAdminArticleReviewMarker(marked, 'family-b', false);

  assert.deepEqual(Array.from(original), ['family-b']);
  assert.deepEqual(Array.from(marked), ['family-b', 'family-a']);
  assert.deepEqual(Array.from(unmarked), ['family-a']);
  assert.equal(serializeAdminArticleReviewMarkers(marked), '["family-a","family-b"]');
  assert.equal(ADMIN_ARTICLE_REVIEW_MARKERS_STORAGE_KEY, 'atehna:admin:artikli:reviewed:v1');
});

test('article review mode reuses the canonical completed email row tone', () => {
  assert.equal(
    adminTableRowToneClasses.success,
    getOrderEmailEventStatusPresentation('finished').rowClassName
  );
  assert.equal(adminTableRowToneClasses.success, 'bg-emerald-50 hover:!bg-emerald-100');
});

test('article review controls are opt-in, accessible, local, and ordered before opening an article', () => {
  assert.match(managerSource, /data-testid="admin-items-review-mode-toggle"/u);
  assert.match(managerSource, /aria-pressed=\{isReviewModeEnabled\}/u);
  assert.match(managerSource, /<Code2 className="!h-\[18px\] !w-\[18px\]" \/>/u);
  assert.match(
    managerSource,
    /\.\.\.\(isReviewModeEnabled[\s\S]*?key: 'review-marker'[\s\S]*?Označi za ponovni pregled[\s\S]*?Označi kot pregledano[\s\S]*?key: 'open'/u
  );
  assert.match(
    managerSource,
    /isReviewModeEnabled && isFamilyReviewed[\s\S]*?adminTableRowToneClasses\.success/u
  );
  assert.match(managerSource, /window\.localStorage\.setItem/u);
  assert.match(managerSource, /window\.addEventListener\('storage', handleStorage\)/u);
  assert.match(managerSource, /aria-describedby=\{isReviewModeEnabled && isFamilyReviewed/u);
  assert.match(managerSource, /Artikel je označen kot pregledan\./u);
  assert.doesNotMatch(
    managerSource,
    /setReviewedFamilyIds\(\(current\) => \{[\s\S]*?localStorage\.setItem/u
  );
  assert.doesNotMatch(managerSource, /fetch\([^)]*review/iu);
});

test('article prices reserve the header filter gutter in read and edit rows', () => {
  assert.match(
    managerSource,
    /PRICE_COLUMN_CLASS[\s\S]*?<div className="relative inline-flex items-center gap-2"[\s\S]*?title="Prodajna cena brez DDV"[\s\S]*?aria-label="Filtriraj Cena"/u
  );
  assert.match(managerSource, /const PRICE_COLUMN_CLASS = 'w-\[12%\]'/u);
  assert.match(
    managerSource,
    /const PriceColumnTrailingControlSpacer = \(\) => \([\s\S]*?h-5 w-5 shrink-0[\s\S]*?data-product-price-filter-gutter="true"/u
  );
  assert.equal(managerSource.match(/<PriceColumnTrailingControlSpacer \/>/gu)?.length, 5);

  for (const [marker, editing] of [
    ['data-article-price={family.id}', 'isEditingFamily'],
    ['data-variant-price={variant.id}', 'isEditing']
  ]) {
    const start = managerSource.indexOf(marker);
    const end = managerSource.indexOf('</td>', start);
    assert.ok(start >= 0 && end > start, 'Missing price cell ' + marker);
    const cell = managerSource.slice(start, end);
    assert.match(cell, /className=\{fieldStyles\.priceSlot\}/u);
    assert.match(cell, /<ArticleTableNumber[\s\S]*?unit="€"/u);
    assert.ok(cell.includes('editing={' + editing + '}'));
    assert.match(cell, /<PriceColumnTrailingControlSpacer \/>/u);
  }

  assert.match(numberFieldSource, /className=\{styles\.numberField\} data-editing=\{editing \|\| undefined\}/u);
  assert.match(numberFieldSource, /<input[^>]*className=\{styles\.numberValue\}/u);
  assert.match(numberFieldSource, /className=\{styles\.numberReadout\}/u);
  assert.match(fieldStyles, /\.numberField\s*\{[^}]*width: 100%;[^}]*min-width: 0;[^}]*height: 28px;[^}]*overflow: hidden;[^}]*border: 1px solid transparent;/u);
  assert.match(fieldStyles, /\.numberValue\s*\{[^}]*height: 26px;[^}]*text-align: right;[^}]*line-height: 26px;/u);
  assert.match(fieldStyles, /\.numberReadout\s*\{[^}]*justify-content: flex-end;[^}]*width: 100%;[^}]*min-width: 0;/u);
  assert.match(fieldStyles, /\.priceSlot\s*\{[^}]*gap: 8px;[^}]*width: 100%;[^}]*min-width: 0;/u);
  assert.match(
    managerSource,
    /priceFilterButtonRef[\s\S]*?onClick=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\)/u
  );
});
