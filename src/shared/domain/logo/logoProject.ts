import { LOGO_FONT_FAMILIES, cloneLogoProject, flattenLogoLayers, type LogoBounds, type LogoLayer, type LogoProject, type LogoSourceAsset } from './logoLibrary';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Projekt vsebuje neveljaven objekt.');
  return value as Record<string, unknown>;
};
const number = (value: unknown, name: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name}: dovoljena vrednost je med ${min} in ${max}.`);
  return value;
};
const string = (value: unknown, name: string, max = 120): string => {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${name}: neveljavno besedilo.`);
  return value;
};
const boolean = (value: unknown): boolean => { if (typeof value !== 'boolean') throw new Error('Neveljavno stanje sloja.'); return value; };
const color = (value: unknown): string => {
  if (typeof value !== 'string' || !/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|none|transparent)$/i.test(value)) throw new Error('Uporabite barvo HEX ali brez barve.');
  return value;
};
const rect = (value: unknown, normalized = false): LogoBounds => {
  const r = record(value), limit = normalized ? 1 : 8192;
  const result = { x: number(r.x, 'X', normalized ? 0 : -32768, normalized ? 1 : 32768), y: number(r.y, 'Y', normalized ? 0 : -32768, normalized ? 1 : 32768), width: number(r.width, 'Širina', .0001, limit), height: number(r.height, 'Višina', .0001, limit) };
  if (normalized && (result.x + result.width > 1.000001 || result.y + result.height > 1.000001)) throw new Error('Izrez sega izven izvorne slike.');
  return result;
};
/** Strict project boundary shared by draft saving, importing and publishing. */
export function validateLogoProject(input: unknown, assets?: readonly LogoSourceAsset[]): LogoProject {
  const project = record(input), canvas = record(project.canvas);
  if (project.version !== 1 || !Array.isArray(project.layers)) throw new Error('Nepodprta različica projekta logotipa.');
  const width = number(canvas.width, 'Širina platna', 1, 8192), height = number(canvas.height, 'Višina platna', 1, 8192);
  if (width * height > 4_000_000) throw new Error('Platno lahko vsebuje največ 4 milijone slikovnih pik.');
  const ids = new Set<string>(); let count = 0, textLength = 0;
  const readLayer = (inputLayer: unknown, depth: number): LogoLayer => {
    if (++count > 200 || depth > 8) throw new Error('Projekt lahko vsebuje največ 200 slojev in 8 ravni skupin.');
    const layer = record(inputLayer), id = string(layer.id, 'ID sloja', 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Sloji morajo imeti različne veljavne identifikatorje.');
    ids.add(id);
    const base = { ...rect(layer), id, name: string(layer.name, 'Ime sloja'), rotation: number(layer.rotation, 'Zasuk', -3600, 3600), opacity: number(layer.opacity, 'Prosojnost', 0, 1), visible: boolean(layer.visible), locked: boolean(layer.locked), ...(layer.shadow === undefined ? {} : { shadow: (() => { const s = record(layer.shadow); return { color: color(s.color), opacity: number(s.opacity, 'Prosojnost sence', 0, 1), blur: number(s.blur, 'Zameglitev', 0, 128), offsetX: number(s.offsetX, 'Odmik sence X', -512, 512), offsetY: number(s.offsetY, 'Odmik sence Y', -512, 512) }; })() }) };
    if (layer.type === 'group') {
      if (!Array.isArray(layer.children)) throw new Error('Skupina nima veljavnih slojev.');
      return { ...base, type: 'group', children: layer.children.map(child => readLayer(child, depth + 1)) };
    }
    if (layer.type === 'image') {
      const assetId = string(layer.assetId, 'Vir slike', 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(assetId) || (assets && !assets.some(asset => asset.id === assetId))) throw new Error('Izvorna slika sloja ni na voljo.');
      if (layer.mask !== 'rectangle' && layer.mask !== 'ellipse') throw new Error('Nepodprta maska slike.');
      return { ...base, type: 'image', assetId, crop: rect(layer.crop, true), mask: layer.mask };
    }
    if (layer.type === 'text') {
      if (layer.fontFamily === 'Noto Sans' && (layer.fontStyle !== 'normal' || ![400, 700].includes(layer.fontWeight as number))) throw new Error('Noto Sans podpira običajno in krepko pisavo brez ležečega sloga.');
      const text = string(layer.text, 'Besedilo', 2000); textLength += text.length;
      if (textLength > 10000) throw new Error('Projekt vsebuje preveč besedila.');
      if (!(LOGO_FONT_FAMILIES as readonly unknown[]).includes(layer.fontFamily) || ![400, 500, 600, 700].includes(layer.fontWeight as number) || !['normal', 'italic'].includes(String(layer.fontStyle)) || !['left', 'center', 'right'].includes(String(layer.textAlign))) throw new Error('Nepodprta pisava ali slog besedila.');
      return { ...base, type: 'text', text, fontFamily: layer.fontFamily as 'Inter', fontSize: number(layer.fontSize, 'Velikost pisave', 1, 1024), fontWeight: layer.fontWeight as 400, fontStyle: layer.fontStyle as 'normal', fill: color(layer.fill), textAlign: layer.textAlign as 'left', lineHeight: number(layer.lineHeight, 'Medvrstični razmik', .5, 5), letterSpacing: number(layer.letterSpacing, 'Razmik črk', -64, 1024) };
    }
    if (layer.type === 'shape') {
      if (!['rectangle', 'ellipse', 'line', 'path'].includes(String(layer.shape))) throw new Error('Nepodprta oblika.');
      const d = layer.path === undefined ? undefined : string(layer.path, 'Vektorska pot', 200000);
      if (d !== undefined && !/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]*$/.test(d)) throw new Error('Neveljavna vektorska pot.');
      if (layer.shape === 'path' && (!d || !layer.pathViewBox)) throw new Error('Manjkajo podatki vektorske poti.');
      return { ...base, type: 'shape', shape: layer.shape as 'rectangle', fill: color(layer.fill), stroke: color(layer.stroke), strokeWidth: number(layer.strokeWidth, 'Obroba', 0, 256), radius: number(layer.radius, 'Zaobljenost', 0, 4096), ...(d === undefined ? {} : { path: d }), ...(layer.pathViewBox === undefined ? {} : { pathViewBox: rect(layer.pathViewBox) }) };
    }
    throw new Error('Nepodprt sloj logotipa.');
  };
  return { version: 1, canvas: { width, height }, layers: project.layers.map(layer => readLayer(layer, 0)) };
}

export function findLogoLayer(project: LogoProject, id: string): LogoLayer | undefined { return flattenLogoLayers(project.layers).find(layer => layer.id === id); }

export function updateLogoLayers(project: LogoProject, ids: readonly string[], update: (layer: LogoLayer) => void): LogoProject {
  const next = cloneLogoProject(project), selected = new Set(ids);
  const visit = (layers: LogoLayer[], ancestorLocked: boolean) => {
    for (const layer of layers) {
      if (selected.has(layer.id)) {
        if (ancestorLocked || layer.locked) {
          const proposed = structuredClone(layer); update(proposed);
          layer.name = proposed.name; layer.visible = proposed.visible; layer.locked = proposed.locked;
        } else update(layer);
        // A selected group already moves/resizes its children; never transform them twice.
      } else if (layer.type === 'group') visit(layer.children, ancestorLocked || layer.locked);
    }
  };
  visit(next.layers, false); return next;
}
export function removeLogoLayers(project: LogoProject, ids: readonly string[]): LogoProject {
  const next = cloneLogoProject(project);
  const filter = (layers: LogoLayer[], ancestorLocked = false): LogoLayer[] => layers.filter(layer => !ids.includes(layer.id) || layer.locked || ancestorLocked).map(layer => layer.type === 'group' ? { ...layer, children: filter(layer.children, ancestorLocked || layer.locked) } : layer);
  next.layers = filter(next.layers); return next;
}
export function copyLogoLayer(layer: LogoLayer): LogoLayer {
  const next = structuredClone(layer); next.id = crypto.randomUUID();
  if (next.type === 'group') next.children = next.children.map(copyLogoLayer);
  return next;
}
export function duplicateLogoLayers(project: LogoProject, ids: readonly string[]): { project: LogoProject; ids: string[] } {
  const next = cloneLogoProject(project), copies: string[] = [];
  const duplicate = (layers: LogoLayer[]): LogoLayer[] => layers.flatMap(layer => {
    if (ids.includes(layer.id)) { const copy = copyLogoLayer(layer); copy.x += 12; copy.y += 12; copy.name += ' · kopija'; copies.push(copy.id); return [layer, copy]; }
    return [layer.type === 'group' ? { ...layer, children: duplicate(layer.children) } : layer];
  });
  next.layers = duplicate(next.layers); return { project: next, ids: copies };
}
export function rotateLogoPoint(x: number, y: number, cx: number, cy: number, rotation: number) {
  const r = rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: cx + (x - cx) * c - (y - cy) * s, y: cy + (x - cx) * s + (y - cy) * c };
}
type LogoMatrix = { a: number; b: number; c: number; d: number; e: number; f: number };
const identityMatrix: LogoMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const matrixPoint = (m: LogoMatrix, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
function childMatrix(parent: LogoMatrix, layer: LogoLayer): LogoMatrix {
  const angle = layer.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), cx = layer.width / 2, cy = layer.height / 2;
  const e = layer.x + cx - c * cx + s * cy, f = layer.y + cy - s * cx - c * cy;
  return { a: parent.a * c + parent.c * s, b: parent.b * c + parent.d * s, c: -parent.a * s + parent.c * c, d: -parent.b * s + parent.d * c, e: parent.a * e + parent.c * f + parent.e, f: parent.b * e + parent.d * f + parent.f };
}
function worldLayerBounds(layer: LogoLayer, parent: LogoMatrix): LogoBounds {
  const m = childMatrix(parent, layer), points = [[0, 0], [layer.width, 0], [0, layer.height], [layer.width, layer.height]].map(([x, y]) => matrixPoint(m, x, y));
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
export function logoLayerBounds(layer: LogoLayer): LogoBounds { return worldLayerBounds(layer, identityMatrix); }
export function unionLogoBounds(bounds: LogoBounds[]): LogoBounds | null {
  if (!bounds.length) return null;
  const x = Math.min(...bounds.map(b => b.x)), y = Math.min(...bounds.map(b => b.y));
  return { x, y, width: Math.max(...bounds.map(b => b.x + b.width)) - x, height: Math.max(...bounds.map(b => b.y + b.height)) - y };
}

type LayerContext = { layer: LogoLayer; siblings: LogoLayer[]; parent: LogoLayer | null; matrix: LogoMatrix; locked: boolean };
function layerContexts(project: LogoProject): Map<string, LayerContext> {
  const contexts = new Map<string, LayerContext>();
  const visit = (siblings: LogoLayer[], parent: LogoLayer | null, matrix: LogoMatrix, locked: boolean) => {
    for (const layer of siblings) {
      contexts.set(layer.id, { layer, siblings, parent, matrix, locked: locked || layer.locked });
      if (layer.type === 'group') visit(layer.children, layer, childMatrix(matrix, layer), locked || layer.locked);
    }
  };
  visit(project.layers, null, identityMatrix, false); return contexts;
}
export function isLogoLayerLocked(project: LogoProject, id: string): boolean { return layerContexts(project).get(id)?.locked ?? true; }
function selectedSiblings(project: LogoProject, ids: readonly string[]): LayerContext[] {
  const contexts = layerContexts(project), chosen = [...new Set(ids)].map(id => contexts.get(id));
  if (chosen.some(item => !item)) throw new Error('Izbrani sloj ni več na voljo.');
  const selected = chosen as LayerContext[];
  if (selected.some(item => item.parent !== selected[0]?.parent)) throw new Error('Izberite sloje znotraj iste skupine. Mešanih ravni ni mogoče poravnati ali združiti.');
  return selected;
}
export function resizeLogoLayer(layer: LogoLayer, width: number, height: number) {
  if (layer.locked) return;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < .1 || height < .1 || width > 8192 || height > 8192) throw new Error('Mere sloja niso veljavne.');
  const sx = width / layer.width, sy = height / layer.height;
  if (layer.type === 'group' && Math.abs(sx - sy) > .000001 && flattenLogoLayers(layer.children).some(child => Math.abs(child.rotation % 180) > .000001)) throw new Error('Pri skupini z zasukanimi sloji ohranite razmerje stranic.');
  const resize = (item: LogoLayer, xScale: number, yScale: number) => {
    if (item.type === 'group') for (const child of item.children) { child.x *= xScale; child.y *= yScale; resize(child, xScale, yScale); }
    if (item.type === 'text') { item.fontSize *= yScale; item.letterSpacing *= xScale; }
    if (item.type === 'shape') { item.strokeWidth *= Math.min(xScale, yScale); item.radius *= Math.min(xScale, yScale); }
    if (item.shadow) { item.shadow.blur *= Math.min(xScale, yScale); item.shadow.offsetX *= xScale; item.shadow.offsetY *= yScale; }
    item.width = Math.max(.1, item.width * xScale); item.height = Math.max(.1, item.height * yScale);
  };
  resize(layer, sx, sy);
}
export function groupLogoLayers(project: LogoProject, ids: readonly string[]): { project: LogoProject; id: string } {
  const next = cloneLogoProject(project), selected = selectedSiblings(next, ids);
  if (selected.length < 2) throw new Error('Za skupino izberite vsaj dva sloja na isti ravni.');
  if (selected.some(item => item.locked)) throw new Error('Pred združevanjem odklenite izbrane sloje in njihovo skupino.');
  const siblings = selected[0].siblings, selectedIds = new Set(selected.map(item => item.layer.id));
  const ordered = siblings.filter(layer => selectedIds.has(layer.id)), bounds = unionLogoBounds(ordered.map(logoLayerBounds))!;
  const id = crypto.randomUUID();
  const group: LogoLayer = { ...bounds, type: 'group', id, name: 'Skupina', rotation: 0, opacity: 1, visible: true, locked: false, children: ordered.map(layer => ({ ...layer, x: layer.x - bounds.x, y: layer.y - bounds.y })) };
  const last = siblings.findLastIndex(layer => selectedIds.has(layer.id));
  const replacement = siblings.flatMap((layer, index) => index === last ? [group] : selectedIds.has(layer.id) ? [] : [layer]);
  siblings.splice(0, siblings.length, ...replacement);
  return { project: next, id };
}
export function ungroupLogoLayer(project: LogoProject, id: string): { project: LogoProject; ids: string[] } {
  const next = cloneLogoProject(project), context = layerContexts(next).get(id);
  if (!context || context.layer.type !== 'group') return { project: next, ids: [] };
  const group = context.layer;
  if (context.locked) throw new Error('Pred razdruževanjem odklenite skupino.');
  if (group.opacity !== 1 || (group.shadow && group.shadow.opacity > 0)) throw new Error('Pred razdruževanjem nastavite prosojnost skupine na 100 % in odstranite njeno senco, da se videz ne spremeni.');
  const children = group.children.map(child => {
    const center = rotateLogoPoint(child.x + child.width / 2, child.y + child.height / 2, group.width / 2, group.height / 2, group.rotation);
    return { ...child, x: group.x + center.x - child.width / 2, y: group.y + center.y - child.height / 2, rotation: child.rotation + group.rotation, visible: child.visible && group.visible };
  });
  context.siblings.splice(context.siblings.indexOf(group), 1, ...children);
  return { project: next, ids: children.map(child => child.id) };
}
export function reorderLogoLayer(project: LogoProject, id: string, direction: -1 | 1): LogoProject {
  const next = cloneLogoProject(project), context = layerContexts(next).get(id);
  if (!context || context.locked) return next;
  const { siblings, layer } = context, index = siblings.indexOf(layer), target = index + direction;
  if (target >= 0 && target < siblings.length && !siblings[target].locked) [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  return next;
}
export function alignLogoLayers(project: LogoProject, ids: readonly string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical', relativeTo: 'canvas' | 'selection'): LogoProject {
  const selected = selectedSiblings(project, ids).filter(item => !item.locked);
  if (!selected.length) return project;
  const boxes = selected.map(item => ({ ...item, bounds: worldLayerBounds(item.layer, item.matrix) }));
  const bounds = relativeTo === 'canvas' ? { x: 0, y: 0, ...project.canvas } : unionLogoBounds(boxes.map(item => item.bounds))!;
  const shifts = new Map<string, { x: number; y: number }>();
  if (alignment === 'horizontal' || alignment === 'vertical') {
    if (selected.length < 3) return project;
    const horizontal = alignment === 'horizontal', axis = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height';
    const sorted = boxes.toSorted((a, b) => a.bounds[axis] - b.bounds[axis]);
    const gap = (bounds[size] - sorted.reduce((sum, item) => sum + item.bounds[size], 0)) / (sorted.length - 1);
    let at = bounds[axis];
    for (const item of sorted) { shifts.set(item.layer.id, { x: horizontal ? at - item.bounds[axis] : 0, y: horizontal ? 0 : at - item.bounds[axis] }); at += item.bounds[size] + gap; }
  } else for (const item of boxes) {
    const box = item.bounds;
    const x = alignment === 'left' ? bounds.x - box.x : alignment === 'center' ? bounds.x + bounds.width / 2 - box.x - box.width / 2 : alignment === 'right' ? bounds.x + bounds.width - box.x - box.width : 0;
    const y = alignment === 'top' ? bounds.y - box.y : alignment === 'middle' ? bounds.y + bounds.height / 2 - box.y - box.height / 2 : alignment === 'bottom' ? bounds.y + bounds.height - box.y - box.height : 0;
    shifts.set(item.layer.id, { x, y });
  }
  const matrix = selected[0].matrix, determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  return updateLogoLayers(project, selected.map(item => item.layer.id), layer => {
    const delta = shifts.get(layer.id)!;
    layer.x += (matrix.d * delta.x - matrix.c * delta.y) / determinant;
    layer.y += (-matrix.b * delta.x + matrix.a * delta.y) / determinant;
  });
}
export function trimLogoCanvas(project: LogoProject, bounds: LogoBounds): LogoProject {
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error('Meje vsebine niso veljavne.');
  if (bounds.width < .1 || bounds.height < .1) return project;
  const next = cloneLogoProject(project), x = Math.floor(bounds.x), y = Math.floor(bounds.y);
  next.canvas = { width: Math.max(1, Math.ceil(bounds.x + bounds.width) - x), height: Math.max(1, Math.ceil(bounds.y + bounds.height) - y) };
  for (const layer of next.layers) { layer.x -= x; layer.y -= y; }
  return validateLogoProject(next);
}

