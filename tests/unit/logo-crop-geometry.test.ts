import assert from 'node:assert/strict';
import test from 'node:test';
import { canFitLogoCropAspect, drawLogoCrop, fitLogoCropAspect, logoCropPoint, normalizeLogoCrop, setLogoCropPixels, transformLogoCrop, type LogoCropResize } from '@/admin/features/podoba/components/logoCropGeometry';
import type { LogoBounds } from '@/shared/domain/logo/logoLibrary';

const source = { width: 800, height: 400 };
const modes: LogoCropResize[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
function valid(crop: LogoBounds, size = source) {
  assert.ok(Object.values(crop).every(Number.isFinite));
  assert.ok(crop.x >= -1e-12 && crop.y >= -1e-12);
  assert.ok(crop.width >= Math.max(.0001, 1 / size.width), `width ${crop.width}`);
  assert.ok(crop.height >= Math.max(.0001, 1 / size.height), `height ${crop.height}`);
  assert.ok(crop.x + crop.width <= 1 + 1e-12 && crop.y + crop.height <= 1 + 1e-12);
}

test('free crop moves within the source, preserves size, and never mutates its input', () => {
  const initial = Object.freeze({ x: .2, y: .25, width: .4, height: .5 });
  assert.deepEqual(transformLogoCrop(initial, 'move', 2, -2, source), { x: .6, y: 0, width: .4, height: .5 });
  assert.deepEqual(initial, { x: .2, y: .25, width: .4, height: .5 });
});

test('all eight free resize handles keep the opposite edges anchored and bounded', () => {
  const initial = { x: .2, y: .25, width: .4, height: .5 };
  for (const mode of modes) {
    const changed = transformLogoCrop(initial, mode, .04, -.03, source);
    valid(changed);
    if (mode.includes('w')) close(changed.x + changed.width, initial.x + initial.width); else close(changed.x, initial.x);
    if (mode.includes('n')) close(changed.y + changed.height, initial.y + initial.height); else close(changed.y, initial.y);
    for (const delta of [-10, 10]) valid(transformLogoCrop(initial, mode, delta, delta, source));
  }
});

test('aspect presets use source pixels rather than normalized width/height', () => {
  const full = { x: 0, y: 0, width: 1, height: 1 };
  assert.deepEqual(fitLogoCropAspect(full, source, 1), { x: .25, y: 0, width: .5, height: 1 });
  assert.deepEqual(fitLogoCropAspect(full, source, source.width / source.height), full);
  for (const ratio of [1, 4 / 3, 16 / 9]) {
    const crop = fitLogoCropAspect({ x: .1, y: .2, width: .7, height: .6 }, source, ratio);
    valid(crop); close(crop.width * source.width / (crop.height * source.height), ratio);
  }
  assert.equal(canFitLogoCropAspect({ width: 1, height: 1 }, 16 / 9), false);
});

test('locked corners and edge handles preserve pixel aspect and stay inside bounds', () => {
  for (const size of [source, { width: 400, height: 800 }, { width: 16000, height: 1000 }]) for (const ratio of [1, 4 / 3, 16 / 9]) {
    const initial = fitLogoCropAspect({ x: .2, y: .2, width: .6, height: .6 }, size, ratio);
    for (const mode of modes) for (const [dx, dy] of [[.07, -.09], [-10, -10], [10, 10]]) {
      const crop = transformLogoCrop(initial, mode, dx, dy, size, ratio);
      valid(crop, size); close(crop.width * size.width / (crop.height * size.height), ratio);
      if (mode === 'w' || mode === 'e') close(crop.y + crop.height / 2, initial.y + initial.height / 2);
      if (mode === 'n' || mode === 's') close(crop.x + crop.width / 2, initial.x + initial.width / 2);
    }
  }
});

test('drawing works in every direction including source boundaries and pixel-sized selections', () => {
  for (const ratio of [null, 1, 16 / 9]) for (const start of [{ x: .5, y: .5 }, { x: 0, y: 0 }, { x: 1, y: 1 }]) for (const end of [{ x: .1, y: .2 }, { x: .9, y: .8 }, start]) {
    const crop = drawLogoCrop(start, end, source, ratio);
    valid(crop);
    if (ratio !== null) close(crop.width * source.width / (crop.height * source.height), ratio);
  }
});

test('responsive pointer mapping and pixel edits preserve the same non-destructive coordinate system', () => {
  assert.deepEqual(logoCropPoint(300, 200, { left: 100, top: 100, width: 400, height: 200 }), { x: .5, y: .5 });
  assert.deepEqual(logoCropPoint(450, 300, { left: 50, top: 100, width: 800, height: 400 }), { x: .5, y: .5 });
  assert.deepEqual(logoCropPoint(-20, 999, { left: 100, top: 100, width: 400, height: 200 }), { x: 0, y: 1 });
  const initial = fitLogoCropAspect({ x: 0, y: 0, width: 1, height: 1 }, source, 1);
  const resized = setLogoCropPixels(initial, 'width', 200, source, 1);
  close(resized.width * source.width, 200); close(resized.height * source.height, 200);
  const moved = setLogoCropPixels(resized, 'x', 9999, source, 1);
  valid(moved); close(moved.x + moved.width, 1);
  assert.deepEqual(setLogoCropPixels(initial, 'width', NaN, source), initial);
  valid(normalizeLogoCrop({ x: NaN, y: 2, width: 0, height: Infinity }, source));
});
