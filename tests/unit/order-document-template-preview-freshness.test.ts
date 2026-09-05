import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/urejevalnik/components/AdminOrderDocumentTemplateEditor.tsx'
  ),
  'utf8'
);

test('exact PDF preview is rendered only for the current request identity', () => {
  assert.match(source, /previewDocument\?\.requestKey === previewRequestKey/u);
  assert.match(source, /previewState\.requestKey === previewRequestKey/u);
  assert.match(source, /\{activePreviewDocument \? \(/u);
  assert.match(source, /activePreviewDocument\.pages\.map/u);
  assert.match(source, /preview=\{activePreviewDocument\}/u);
  assert.doesNotMatch(source, /src=\{previewUrl\}/u);
});

test('request changes clear stale documents and revoke their object URLs', () => {
  assert.match(
    source,
    /previewDocumentRef\.current\?\.requestKey !== previewRequestKey[\s\S]*?replacePreviewDocument\(null\)/u
  );
  assert.match(source, /URL\.revokeObjectURL\(previousDocument\.url\)/u);
  assert.match(source, /URL\.revokeObjectURL\(previewDocumentRef\.current\.url\)/u);
  assert.match(
    source,
    /replacePreviewDocument\(\{ requestKey: previewRequestKey, \.\.\.rendered \}\)/u
  );
});

test('switching templates clears the preview while view changes reuse its exact artwork', () => {
  assert.match(
    source,
    /const resetPreviewSession = useCallback\(\(\) => \{[\s\S]*?previewAbortRef\.current\?\.abort\(\)[\s\S]*?replacePreviewDocument\(null\)[\s\S]*?setPreviewState\(\{ requestKey: null, loading: false, error: null \}\)/u
  );
  assert.match(
    source,
    /if \(type !== selectedType\) resetPreviewSession\(\);[\s\S]*?setSelectedType\(type\)/u
  );
  assert.doesNotMatch(source, /resetPreviewSession\(\);\s*setViewMode\('canvas'\)/u);
  assert.doesNotMatch(source, /if \(viewMode !== 'pdf'\)/u);
});

test('the exact preview uses one consistent user-facing name', () => {
  assert.match(source, /> Predogled PDFja\s*</u);
  assert.match(source, /aria-label="Predogled PDFja"/u);
  assert.match(source, />Predogled PDFja<\/h2>/u);
  assert.match(source, /aria-label=\{`Predogled PDFja – \$\{currentTemplate\.name\}`\}/u);
  assert.doesNotMatch(source, /Natančen(?: predogled)? PDF/u);
});
