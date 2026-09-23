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

test('request changes hide stale documents and reuse only an exact cached identity', () => {
  assert.match(
    source,
    /previewDocumentRef\.current\?\.requestKey !== previewRequestKey[\s\S]*?replacePreviewDocument\(null\)/u
  );
  assert.match(source, /template: currentTemplate,[\s\S]*?logoRevision: logoConfig\.revision/u);
  assert.match(source, /JSON\.stringify\(\{ body: previewRequestBody, nonce: previewNonce \}\)/u);
  assert.match(source, /new Map<OrderDocumentTemplateType, PreviewDocument>\(\)/u);
  assert.match(
    source,
    /const cached = previewCacheRef\.current\.get\(selectedType\);\s*if \(cached\?\.requestKey === previewRequestKey\) \{[\s\S]*?replacePreviewDocument\(cached\);\s*setPreviewState\(\{ requestKey: previewRequestKey, loading: false, error: null \}\);\s*return undefined;/u
  );
});

test('cached URLs are revoked on eviction and unmount rather than merely changing the visible preview', () => {
  assert.match(
    source,
    /const previous = previewCacheRef\.current\.get\(selectedType\);\s*if \(previous\) URL\.revokeObjectURL\(previous\.url\);[\s\S]*?previewCacheRef\.current\.set\(selectedType, nextDocument\);\s*replacePreviewDocument\(nextDocument\)/u
  );
  assert.match(
    source,
    /useEffect\(\s*\(\) => \(\) => \{\s*previewAbortRef\.current\?\.abort\(\);\s*for \(const document of previewCacheRef\.current\.values\(\)\) URL\.revokeObjectURL\(document\.url\);\s*previewCacheRef\.current\.clear\(\);\s*previewDocumentRef\.current = null;/u
  );
  const replaceStart = source.indexOf('const replacePreviewDocument = useCallback');
  const replaceEnd = source.indexOf('const resetPreviewSession', replaceStart);
  assert.ok(replaceStart >= 0 && replaceEnd > replaceStart);
  assert.doesNotMatch(source.slice(replaceStart, replaceEnd), /URL\.revokeObjectURL/u);
});

test('cancelled renders cannot publish artwork or leak newly created URLs', () => {
  assert.match(
    source,
    /const rendered = await renderOrderDocumentPreview\(payload, controller\.signal\);\s*if \(disposed\) \{ URL\.revokeObjectURL\(rendered\.url\); return; \}\s*const nextDocument = \{ requestKey: previewRequestKey, \.\.\.rendered \};/u
  );
  assert.match(
    source,
    /return \(\) => \{\s*disposed = true;\s*window\.clearTimeout\(timer\);\s*controller\.abort\(\);/u
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
