import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const sidebarSource = readFileSync(
  resolve(process.cwd(), 'src/admin/components/AdminSidebar.tsx'),
  'utf8'
).replace(/\r\n?/g, '\n');

function primaryGroupLabels(): string[][] {
  const start = sidebarSource.indexOf('const primaryLinkGroups = [');
  const end = sidebarSource.indexOf('\n] as const;', start);
  assert.ok(start >= 0 && end > start, 'Primary sidebar link groups are missing');

  const model = sidebarSource.slice(start, end);
  return Array.from(model.matchAll(/^  \[\n([\s\S]*?)^  \](?:,)?$/gmu), (match) =>
    Array.from(match[1].matchAll(/label: '([^']+)'/gu), (labelMatch) => labelMatch[1])
  );
}

test('admin sidebar follows the requested grouped navigation order', () => {
  assert.deepEqual(primaryGroupLabels(), [
    ['Naročila', 'Artikli', 'Kategorije', 'Seznam strank', 'Analitika'],
    ['Katalog', 'Urejevalnik', 'Podoba'],
    ['Email', 'Poštnina'],
    ['Arhiv', 'Dnevnik sprememb']
  ]);
});

test('admin sidebar separates every group with subtle rules aligned to the collapsed icon rail', () => {
  assert.match(sidebarSource, /primaryLinkGroups\.map\(\(group, groupIndex\) =>/u);
  assert.match(sidebarSource, /groupIndex > 0 \? \(/u);
  assert.match(sidebarSource, /data-admin-sidebar-separator/u);
  assert.match(
    sidebarSource,
    /<hr[\s\S]*?data-admin-sidebar-separator[\s\S]*?border-slate-300\/75/u
  );
  assert.match(
    sidebarSource,
    /isExpanded[\s\S]*?\? 'mx-2 w-\[calc\(100%-1rem\)\]'[\s\S]*?: 'ml-2\.5 mr-auto w-4'/u
  );
});
