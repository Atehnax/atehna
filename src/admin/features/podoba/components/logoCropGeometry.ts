import type { LogoBounds } from '@/shared/domain/logo/logoLibrary';

export type LogoCropSize = { width: number; height: number };
export type LogoCropPoint = { x: number; y: number };
export type LogoCropResize = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type LogoCropDrag = 'move' | LogoCropResize;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dimension = (value: number) => Number.isFinite(value) && value > 0 ? value : 1;
const minimum = (source: LogoCropSize) => ({ width: Math.min(1, Math.max(.0001, 1 / dimension(source.width))), height: Math.min(1, Math.max(.0001, 1 / dimension(source.height))) });
const normalizedRatio = (ratio: number, source: LogoCropSize) => ratio * dimension(source.height) / dimension(source.width);

/** Source coordinates remain independent of the image's fitted screen size. */
export function logoCropPoint(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): LogoCropPoint {
  return { x: clamp((x - rect.left) / dimension(rect.width), 0, 1), y: clamp((y - rect.top) / dimension(rect.height), 0, 1) };
}

export function normalizeLogoCrop(crop: LogoBounds, source: LogoCropSize): LogoBounds {
  const min = minimum(source);
  const width = clamp(Number.isFinite(crop.width) ? crop.width : 1, min.width, 1);
  const height = clamp(Number.isFinite(crop.height) ? crop.height : 1, min.height, 1);
  return { x: clamp(Number.isFinite(crop.x) ? crop.x : 0, 0, 1 - width), y: clamp(Number.isFinite(crop.y) ? crop.y : 0, 0, 1 - height), width, height };
}

export function canFitLogoCropAspect(source: LogoCropSize, ratio: number): boolean {
  const min = minimum(source), r = normalizedRatio(ratio, source);
  return Number.isFinite(r) && r > 0 && Math.max(min.width, min.height * r) <= Math.min(1, r) + 1e-12;
}

/** Preset fits inside the current selection, preserving its center wherever possible. */
export function fitLogoCropAspect(crop: LogoBounds, source: LogoCropSize, ratio: number): LogoBounds {
  const initial = normalizeLogoCrop(crop, source);
  if (!canFitLogoCropAspect(source, ratio)) return initial;
  const min = minimum(source), r = normalizedRatio(ratio, source);
  const width = clamp(Math.min(initial.width, initial.height * r), Math.max(min.width, min.height * r), Math.min(1, r));
  const height = width / r;
  return normalizeLogoCrop({ x: clamp(initial.x + (initial.width - width) / 2, 0, 1 - width), y: clamp(initial.y + (initial.height - height) / 2, 0, 1 - height), width, height }, source);
}

/** Corners keep the opposite corner fixed; locked edges resize around the other axis's center. */
export function transformLogoCrop(crop: LogoBounds, mode: LogoCropDrag, dx: number, dy: number, source: LogoCropSize, ratio: number | null = null): LogoBounds {
  const initial = normalizeLogoCrop(crop, source), min = minimum(source);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return initial;
  if (mode === 'move') return { ...initial, x: clamp(initial.x + dx, 0, 1 - initial.width), y: clamp(initial.y + dy, 0, 1 - initial.height) };
  const west = mode.includes('w'), east = mode.includes('e'), north = mode.includes('n'), south = mode.includes('s');
  if (ratio === null || !canFitLogoCropAspect(source, ratio)) {
    const left = west ? clamp(initial.x + dx, 0, initial.x + initial.width - min.width) : initial.x;
    const right = east ? clamp(initial.x + initial.width + dx, initial.x + min.width, 1) : initial.x + initial.width;
    const top = north ? clamp(initial.y + dy, 0, initial.y + initial.height - min.height) : initial.y;
    const bottom = south ? clamp(initial.y + initial.height + dy, initial.y + min.height, 1) : initial.y + initial.height;
    return normalizeLogoCrop({ x: left, y: top, width: right - left, height: bottom - top }, source);
  }
  const r = normalizedRatio(ratio, source), sx = west ? -1 : 1, sy = north ? -1 : 1;
  const anchorX = west ? initial.x + initial.width : initial.x, anchorY = north ? initial.y + initial.height : initial.y;
  if ((west || east) && (north || south)) {
    const requested = Math.abs(dx) >= Math.abs(dy * r) ? initial.width + sx * dx : (initial.height + sy * dy) * r;
    const maximum = Math.min(west ? anchorX : 1 - anchorX, (north ? anchorY : 1 - anchorY) * r);
    const width = clamp(requested, Math.min(maximum, Math.max(min.width, min.height * r)), maximum), height = width / r;
    return normalizeLogoCrop({ x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height }, source);
  }
  if (west || east) {
    const centerY = initial.y + initial.height / 2;
    const maximum = Math.min(west ? anchorX : 1 - anchorX, 2 * Math.min(centerY, 1 - centerY) * r);
    const width = clamp(initial.width + sx * dx, Math.min(maximum, Math.max(min.width, min.height * r)), maximum), height = width / r;
    return normalizeLogoCrop({ x: west ? anchorX - width : anchorX, y: centerY - height / 2, width, height }, source);
  }
  const centerX = initial.x + initial.width / 2;
  const maximum = Math.min(north ? anchorY : 1 - anchorY, 2 * Math.min(centerX, 1 - centerX) / r);
  const height = clamp(initial.height + sy * dy, Math.min(maximum, Math.max(min.height, min.width / r)), maximum), width = height * r;
  return normalizeLogoCrop({ x: centerX - width / 2, y: north ? anchorY - height : anchorY, width, height }, source);
}

export function drawLogoCrop(start: LogoCropPoint, end: LogoCropPoint, source: LogoCropSize, ratio: number | null = null): LogoBounds {
  const min = minimum(source), dx = end.x - start.x, dy = end.y - start.y;
  if (ratio === null || !canFitLogoCropAspect(source, ratio)) return normalizeLogoCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(dx), height: Math.abs(dy) }, source);
  const r = normalizedRatio(ratio, source), minWidth = Math.max(min.width, min.height * r), minHeight = minWidth / r;
  const west = dx < 0 || (dx === 0 && start.x > .5), north = dy < 0 || (dy === 0 && start.y > .5);
  const anchorX = clamp(start.x, west ? minWidth : 0, west ? 1 : 1 - minWidth), anchorY = clamp(start.y, north ? minHeight : 0, north ? 1 : 1 - minHeight);
  const maximum = Math.min(west ? anchorX : 1 - anchorX, (north ? anchorY : 1 - anchorY) * r);
  const width = clamp(Math.max(Math.abs(dx), Math.abs(dy) * r), minWidth, maximum), height = width / r;
  return normalizeLogoCrop({ x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height }, source);
}

export function setLogoCropPixels(crop: LogoBounds, field: keyof LogoBounds, value: number, source: LogoCropSize, ratio: number | null = null): LogoBounds {
  if (!Number.isFinite(value)) return { ...crop };
  if (field === 'x') return transformLogoCrop(crop, 'move', value / source.width - crop.x, 0, source, ratio);
  if (field === 'y') return transformLogoCrop(crop, 'move', 0, value / source.height - crop.y, source, ratio);
  return field === 'width' ? transformLogoCrop(crop, 'e', value / source.width - crop.width, 0, source, ratio) : transformLogoCrop(crop, 's', 0, value / source.height - crop.height, source, ratio);
}
