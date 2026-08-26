import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('appearance editors do not expose obsolete footer logoMode or logoText controls', () => {
  const navigationEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
    ),
    'utf8'
  );
  const landingEditorSource = readFileSync(
    resolve(
      process.cwd(),
      'src/admin/features/podoba/components/AdminLandingPageClient.tsx'
    ),
    'utf8'
  );

  for (const source of [navigationEditorSource, landingEditorSource]) {
    assert.doesNotMatch(source, /value=\{config\.footer\.logoMode\}/u);
    assert.doesNotMatch(source, /value=\{config\.footer\.logoText\}/u);
    assert.doesNotMatch(source, /Besedilo logotipa/u);
    assert.doesNotMatch(source, /Prikaz logotipa v nogi/u);
  }
});
