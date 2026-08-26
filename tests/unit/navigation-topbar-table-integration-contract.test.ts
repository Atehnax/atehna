import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const navigationEditorSource = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'
  ),
  'utf8'
).replace(/\r\n?/gu, '\n');

function sourceBetween(start: string, end: string) {
  const startIndex = navigationEditorSource.indexOf(start);
  const endIndex = navigationEditorSource.indexOf(end, startIndex + start.length);

  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);

  return navigationEditorSource.slice(startIndex, endIndex);
}

test('the top-bar table orders every row by the same resolved X value it displays', () => {
  const editorSource = sourceBetween(
    'function TopBarLayoutEditor(',
    'function IconPicker('
  );

  assert.match(
    editorSource,
    /const tableResolvedXPxById = useMemo\([\s\S]*?tablePlacementGeometry\.elementRects\[item\.id\][\s\S]*?: getTopBarElementXInBounds\(/u,
    'rendered and hidden rows must both receive a resolved table X coordinate'
  );
  assert.match(
    editorSource,
    /const tableLayoutItems = useMemo\(\s*\(\) => sortTopBarTableItemsByResolvedX\(layoutItems, tableResolvedXPxById\)/u
  );
  assert.match(editorSource, /tableLayoutItems\.map\(\(item, index\) => \(/u);
  assert.match(
    editorSource,
    /currentXPx=\{tableResolvedXPxById\[item\.id\] \?\? item\.xPx\}/u,
    'the X column must display the coordinate that determined its row position'
  );
  assert.match(
    editorSource,
    /event\.target\.checked \? tableLayoutItems\.map\(\(item\) => item\.id\) : \[\]/u,
    'table-only operations must follow the resolved visual row view'
  );
  assert.match(editorSource, /isLast=\{index === tableLayoutItems\.length - 1\}/u);
});
