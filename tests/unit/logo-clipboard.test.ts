import assert from 'node:assert/strict';
import test from 'node:test';
import { copyLogoSelection, pasteLogoSelection } from '@/shared/domain/logo/logoClipboard';
import { flattenLogoLayers, type LogoGroupLayer, type LogoImageLayer, type LogoLayer, type LogoProject, type LogoShapeLayer } from '@/shared/domain/logo/logoLibrary';

const shape = (id: string, x = 0, y = 0): LogoShapeLayer => ({ id, name: id, type: 'shape', shape: 'rectangle', x, y, width: 20, height: 10, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#123456', stroke: 'none', strokeWidth: 0, radius: 0 });
const group = (id: string, children: LogoLayer[], x = 0, y = 0, rotation = 0): LogoGroupLayer => ({ ...shape(id, x, y), type: 'group', width: 120, height: 80, rotation, children });
const project = (layers: LogoLayer[]): LogoProject => ({ version: 1, canvas: { width: 640, height: 240 }, layers });
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
// Apply the original hierarchy from leaf to root, independently of clipboard flattening.
function corners(layer: LogoLayer, ancestors: LogoLayer[] = []) {
  return [[0, 0], [layer.width, 0], [layer.width, layer.height], [0, layer.height]].map(point => {
    let [x, y] = point;
    for (const frame of [layer, ...ancestors.toReversed()]) {
      const angle = frame.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const dx = x - frame.width / 2, dy = y - frame.height / 2;
      x = frame.x + frame.width / 2 + dx * c - dy * s;
      y = frame.y + frame.height / 2 + dx * s + dy * c;
    }
    return [x, y];
  });
}
function sameCorners(actual: number[][], expected: number[][], offset = 0) {
  actual.forEach((point, i) => point.forEach((coordinate, axis) => assert.ok(Math.abs(coordinate - expected[i][axis] - offset) < 1e-8, `${coordinate} differs from ${expected[i][axis]} + ${offset}`)));
}

test('clipboard captures a deep snapshot and deduplicates selected ancestors and descendants in paint order', () => {
  const image: LogoImageLayer = { ...shape('image'), type: 'image', assetId: 'source-image', crop: { x: .1, y: .2, width: .5, height: .6 }, mask: 'ellipse', shadow: { color: '#000000', opacity: .2, blur: 4, offsetX: 2, offsetY: 3 } };
  const original = freeze(project([shape('background'), group('outer', [image, group('inner', [shape('nested')])]), shape('foreground')]));
  const before = structuredClone(original);
  const clipboard = copyLogoSelection(original, ['nested', 'foreground', 'outer', 'image', 'outer', 'missing']);
  assert.deepEqual(clipboard.map(layer => layer.id), ['outer', 'foreground']);
  assert.deepEqual(copyLogoSelection(original, []), []);
  assert.deepEqual(copyLogoSelection(original, ['missing']), []);
  const copiedImage = flattenLogoLayers(clipboard).find(layer => layer.id === 'image') as LogoImageLayer;
  copiedImage.crop.x = .25; copiedImage.shadow!.blur = 20;
  const copiedGroup = clipboard[0] as LogoGroupLayer;
  copiedGroup.children.push(shape('new'));
  assert.deepEqual(original, before);
});

test('clipboard resolves mixed nested selections through rotated parents without changing each visual corner', () => {
  const leaf = { ...shape('leaf', 7, 9), rotation: 20 };
  const sibling = { ...shape('sibling', 42, 18), rotation: -15 };
  const inner = { ...group('inner', [leaf, sibling], 10, 15, -30), width: 60, height: 40 };
  const outer = group('outer', [inner, shape('outer-child', 80, 20)], 100, 200, 90);
  const standalone = { ...shape('standalone', 330, 140), rotation: -40 };
  const original = freeze(project([outer, standalone]));
  const clipboard = copyLogoSelection(original, ['standalone', 'leaf', 'outer-child', 'leaf']);
  assert.deepEqual(clipboard.map(layer => layer.id), ['leaf', 'outer-child', 'standalone']);
  sameCorners(corners(clipboard[0]), corners(leaf, [outer, inner]));
  sameCorners(corners(clipboard[1]), corners(outer.children[1], [outer]));
  sameCorners(corners(clipboard[2]), corners(standalone));
  assert.equal(clipboard[0].rotation, 80);
  assert.equal(clipboard[0].width, leaf.width);
  assert.equal(clipboard[0].height, leaf.height);

  const selectedGroup = copyLogoSelection(original, ['inner', 'leaf']);
  assert.equal(selectedGroup.length, 1);
  const lifted = selectedGroup[0] as LogoGroupLayer;
  sameCorners(corners(lifted), corners(inner, [outer]));
  sameCorners(corners(lifted.children[0], [lifted]), corners(leaf, [outer, inner]));
  assert.deepEqual(lifted.children, inner.children);
});

test('each paste gets fresh recursive IDs while preserving assets, nested state and existing project', () => {
  const image: LogoImageLayer = { ...shape('image', 5, 6), type: 'image', assetId: 'reused-original', crop: { x: .1, y: .2, width: .5, height: .6 }, mask: 'rectangle' };
  const original = freeze(project([group('outer', [group('inner', [image])]), shape('existing')]));
  const before = structuredClone(original);
  const clipboard = freeze(copyLogoSelection(original, ['outer']));
  const captured = structuredClone(clipboard);
  const first = pasteLogoSelection(original, clipboard);
  const second = pasteLogoSelection(first.project, clipboard, 24);
  const originalIds = new Set(flattenLogoLayers(original.layers).map(layer => layer.id));
  const firstCopy = first.project.layers.at(-1)!;
  const secondCopy = second.project.layers.at(-1)!;
  const added = [...flattenLogoLayers([firstCopy]), ...flattenLogoLayers([secondCopy])];
  assert.equal(added.length, 6);
  assert.equal(new Set(added.map(layer => layer.id)).size, added.length);
  assert.ok(added.every(layer => !originalIds.has(layer.id)));
  assert.deepEqual(first.ids, [firstCopy.id]); assert.deepEqual(second.ids, [secondCopy.id]);
  assert.equal(firstCopy.name, 'outer · kopija');
  const pastedImage = added.find(layer => layer.type === 'image') as LogoImageLayer;
  assert.equal(pastedImage.assetId, 'reused-original');
  pastedImage.crop.width = .25;
  first.project.canvas.width = 800;
  first.project.layers[0].name = 'Changed only in pasted project';
  assert.deepEqual(original, before);
  assert.deepEqual(clipboard, captured);
  assert.equal((flattenLogoLayers([secondCopy]).find(layer => layer.type === 'image') as LogoImageLayer).crop.width, .5);
});

test('paste offsets only captured roots so nested geometry translates once and clipboard can be reused', () => {
  const leaf = { ...shape('leaf', 12, 8), rotation: 35 };
  const inner = { ...group('inner', [leaf], 18, 14, -25), width: 65, height: 45 };
  const outer = group('outer', [inner], 90, 55, 70);
  const original = freeze(project([outer]));
  const clipboard = freeze(copyLogoSelection(original, ['inner']));
  for (const offset of [0, 12, 24, -5]) {
    const result = pasteLogoSelection(original, clipboard, offset);
    const pastedGroup = result.project.layers.at(-1) as LogoGroupLayer;
    sameCorners(corners(pastedGroup.children[0], [pastedGroup]), corners(leaf, [outer, inner]), offset);
    assert.equal(pastedGroup.children[0].x, leaf.x);
    assert.equal(pastedGroup.children[0].y, leaf.y);
    assert.equal(result.project.layers.length, 2);
  }
  const empty = pasteLogoSelection(original, []);
  assert.deepEqual(empty.project, original); assert.deepEqual(empty.ids, []);
});
