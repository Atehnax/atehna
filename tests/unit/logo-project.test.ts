import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneLogoProject, type LogoLayer, type LogoProject, type LogoShapeLayer, type LogoTextLayer } from '@/shared/domain/logo/logoLibrary';
import { alignLogoLayers, duplicateLogoLayers, findLogoLayer, groupLogoLayers, isLogoLayerLocked, logoLayerBounds, removeLogoLayers, reorderLogoLayer, resizeLogoLayer, trimLogoCanvas, ungroupLogoLayer, updateLogoLayers, validateLogoProject } from '@/shared/domain/logo/logoProject';

const base = (id: string, x = 0, y = 0) => ({ id, name: id, x, y, width: 20, height: 10, rotation: 0, opacity: 1, visible: true, locked: false });
const shape = (id: string, x = 0, y = 0): LogoShapeLayer => ({ ...base(id, x, y), type: 'shape', shape: 'rectangle', fill: '#123456', stroke: '#654321', strokeWidth: 2, radius: 1 });
const project = (layers: LogoLayer[]): LogoProject => ({ version: 1, canvas: { width: 200, height: 100 }, layers });
const group = (children: LogoLayer[], rotation = 0): LogoLayer => ({ id: 'group', name: 'Group', type: 'group', x: 30, y: 20, width: 100, height: 60, rotation, opacity: 1, visible: true, locked: false, children });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const text = (): LogoTextLayer => ({ ...base('text'), type: 'text', text: 'Čžš', fontFamily: 'Noto Sans', fontSize: 20, fontWeight: 400, fontStyle: 'normal', fill: '#000000', textAlign: 'left', lineHeight: 1.2, letterSpacing: 2 });

test('logo project save/load preserves every editable type without aliasing nested state', () => {
  const image: LogoLayer = { ...base('image'), type: 'image', assetId: 'original', crop: { x: .1, y: .2, width: .5, height: .7 }, mask: 'ellipse' };
  const original = project([group([shape('shape'), text(), image])]);
  const saved = validateLogoProject(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(saved, original);
  const cloned = cloneLogoProject(saved);
  findLogoLayer(cloned, 'image')!.x = 500;
  assert.equal(findLogoLayer(original, 'image')!.x, 0);
  assert.equal(findLogoLayer(saved, 'image')!.x, 0);
});

test('logo project validation rejects unsupported data, duplicate IDs, missing assets and unsafe geometry', () => {
  assert.throws(() => validateLogoProject({ ...project([]), version: 2 }));
  assert.throws(() => validateLogoProject(project([shape('same'), shape('same')])));
  assert.throws(() => validateLogoProject(project([{ ...shape('x'), x: Number.NaN }])));
  assert.throws(() => validateLogoProject(project([{ ...shape('x'), fill: 'url(https://example.test)' }])));
  assert.throws(() => validateLogoProject({ ...project([]), canvas: { width: 3000, height: 2000 } }));
  assert.throws(() => validateLogoProject(project([{ ...text(), fontFamily: 'Noto Sans', fontStyle: 'italic' }])));
  assert.throws(() => validateLogoProject(project([{ ...text(), fontFamily: 'Noto Sans', fontWeight: 500 }])));
  assert.throws(() => validateLogoProject(project([{ ...shape('image'), type: 'image', assetId: 'missing', crop: { x: 0, y: 0, width: 1, height: 1 }, mask: 'rectangle' }]), []));
  assert.throws(() => validateLogoProject(project([{ ...shape('image'), type: 'image', assetId: 'original', crop: { x: .8, y: 0, width: .5, height: 1 }, mask: 'rectangle' }])));
  assert.throws(() => validateLogoProject(project(Array.from({ length: 201 }, (_, i) => shape('s' + i)))));
  assert.throws(() => validateLogoProject(project([{ ...shape('path'), shape: 'path', path: 'M0 0<script/>', pathViewBox: { x: 0, y: 0, width: 20, height: 10 } }])));
});

test('duplicating a selected group creates independent descendants only once', () => {
  const original = project([group([shape('a'), text()])]);
  const copy = duplicateLogoLayers(original, ['group', 'a']);
  assert.equal(copy.ids.length, 1); assert.equal(copy.project.layers.length, 2);
  const duplicated = copy.project.layers[1]; assert.equal(duplicated.type, 'group');
  if (duplicated.type !== 'group') return;
  assert.notEqual(duplicated.children[0].id, 'a');
  duplicated.children[0].x = 999;
  assert.equal(findLogoLayer(original, 'a')!.x, 0);
  assert.equal(findLogoLayer(copy.project, 'a')!.x, 0);
});

test('grouping and ungrouping preserve rotated child geometry and input state', () => {
  const original = project([{ ...shape('a', 12, 15), rotation: 25 }, { ...shape('b', 58, 31), rotation: -40 }]);
  const before = JSON.stringify(original), grouped = groupLogoLayers(original, ['a', 'b']);
  const restored = ungroupLogoLayer(grouped.project, grouped.id).project;
  assert.equal(JSON.stringify(original), before);
  for (const id of ['a', 'b']) {
    const a = findLogoLayer(original, id)!, b = findLogoLayer(restored, id)!;
    close(a.x, b.x); close(a.y, b.y); close(a.width, b.width); close(a.height, b.height); close(a.rotation, b.rotation);
  }
  const rotated = project([group([shape('a', 10, 7)], 90)]);
  const child = ungroupLogoLayer(rotated, 'group').project.layers[0];
  close(child.rotation, 90); close(child.x, 88); close(child.y, 15);
});

test('group operations reject mixed parents, locked groups, and unsupported compositing changes', () => {
  const mixed = project([shape('outer'), group([shape('inner')])]);
  assert.throws(() => groupLogoLayers(mixed, ['outer', 'inner']), /iste skupine/u);
  assert.throws(() => alignLogoLayers(mixed, ['outer', 'inner'], 'left', 'canvas'), /iste skupine/u);
  assert.throws(() => ungroupLogoLayer(project([{ ...group([shape('a')]), opacity: .5 }]), 'group'), /100 %/u);
  assert.throws(() => ungroupLogoLayer(project([{ ...group([shape('a')]), locked: true }]), 'group'), /odklenite/u);
});

test('alignment and distribution support siblings within translated and rotated parents', () => {
  const nested = project([group([shape('a', 5, 5), shape('b', 40, 20), shape('c', 75, 30)], 90)]);
  const aligned = alignLogoLayers(nested, ['a', 'b'], 'left', 'canvas');
  const flattened = ungroupLogoLayer(aligned, 'group').project;
  close(logoLayerBounds(findLogoLayer(flattened, 'a')!).x, 0);
  close(logoLayerBounds(findLogoLayer(flattened, 'b')!).x, 0);
  const normal = project([group([shape('a', 2), shape('b', 30), shape('c', 80)])]);
  const distributed = alignLogoLayers(normal, ['a', 'b', 'c'], 'horizontal', 'selection');
  close(findLogoLayer(distributed, 'a')!.x, 2); close(findLogoLayer(distributed, 'b')!.x, 41); close(findLogoLayer(distributed, 'c')!.x, 80);
  assert.equal(findLogoLayer(normal, 'b')!.x, 30);
});

test('locked layers and descendants reject transforms while retaining explicit unlock and visibility controls', () => {
  const original = project([{ ...shape('locked'), locked: true }, shape('free', 50), { ...group([shape('child')]), locked: true }]);
  const modified = updateLogoLayers(original, ['locked', 'child'], layer => { layer.x += 40; layer.rotation = 80; resizeLogoLayer(layer, 40, 30); });
  assert.deepEqual(modified, original);
  assert.equal(isLogoLayerLocked(original, 'child'), true);
  assert.deepEqual(removeLogoLayers(original, ['locked', 'child']), original);
  assert.deepEqual(reorderLogoLayer(original, 'locked', 1), original);
  const aligned = alignLogoLayers(original, ['locked', 'free'], 'left', 'canvas');
  assert.equal(findLogoLayer(aligned, 'locked')!.x, 0); assert.equal(findLogoLayer(aligned, 'free')!.x, 0);
  const unlocked = updateLogoLayers(original, ['locked'], layer => { layer.locked = false; });
  const moved = updateLogoLayers(unlocked, ['locked'], layer => { layer.x = 12; });
  assert.equal(findLogoLayer(moved, 'locked')!.x, 12);
});

test('group resizing scales children and effects and blocks unsupported skew', () => {
  const g = group([{ ...text(), shadow: { color: '#000000', opacity: .5, blur: 2, offsetX: 3, offsetY: 4 } }, shape('a', 10, 5)]);
  resizeLogoLayer(g, 200, 120);
  assert.equal(g.type, 'group'); if (g.type !== 'group') return;
  const child = g.children[0] as LogoTextLayer;
  assert.equal(child.fontSize, 40); assert.equal(child.letterSpacing, 4); assert.equal(child.shadow!.offsetX, 6);
  assert.equal(g.children[1].x, 20); assert.equal((g.children[1] as LogoShapeLayer).strokeWidth, 4);
  assert.throws(() => resizeLogoLayer(group([{ ...shape('rotated'), rotation: 30 }]), 200, 60), /razmerje/u);
});

test('trimming shifts only the canvas origin and leaves a reversible original project', () => {
  const original = project([group([shape('a', 5, 5)]), { ...shape('locked', 60, 30), locked: true }]);
  const saved = cloneLogoProject(original), trimmed = trimLogoCanvas(original, { x: 10.4, y: 12.2, width: 80.2, height: 40.4 });
  assert.deepEqual(trimmed.canvas, { width: 81, height: 41 });
  assert.equal(trimmed.layers[0].x, 20); assert.equal(trimmed.layers[0].y, 8);
  assert.equal(findLogoLayer(trimmed, 'a')!.x, 5);
  assert.equal(findLogoLayer(trimmed, 'locked')!.x, 50);
  assert.deepEqual(original, saved);
  assert.equal(trimLogoCanvas(original, { x: 0, y: 0, width: 0, height: 0 }), original);
});
