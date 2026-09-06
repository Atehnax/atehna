import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit, { type Font } from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { DOMParser, type Element as XmlElement } from '@xmldom/xmldom';
import { logoLayerBounds, unionLogoBounds, validateLogoProject } from '@/shared/domain/logo/logoProject';
import type { LogoBounds, LogoLayer, LogoProject, LogoSourceAsset, LogoTextLayer } from '@/shared/domain/logo/logoLibrary';

export type LogoAssetResolver = (asset: LogoSourceAsset) => Promise<Uint8Array>;
export type DecodedLogoImport = { width: number; height: number; bounds: LogoBounds; warnings: string[]; project?: LogoProject };
const MAX_PIXELS = 16_000_000;
const MAX_BYTES = 10 * 1024 * 1024;
const fonts = new Map<string, Promise<Font>>();
const n = (v: number) => Number(v.toFixed(6));
const xml = (s: string) => s.replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const color = (s: string) => /^(?:#[0-9a-f]{3,8}|none|transparent)$/iu.test(s) ? s : (() => { throw new Error('Barva logotipa ni veljavna.'); })();

function dimensions(width: number, height: number, scale = 1) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height * scale * scale > MAX_PIXELS) throw new Error('Logotip presega dovoljene mere ali 16 milijonov slikovnih točk.');
}

async function fontFor(layer: Pick<LogoTextLayer, 'fontFamily' | 'fontWeight' | 'fontStyle'>): Promise<Font> {
  if (!['Inter', 'Barlow', 'Bitter', 'Noto Sans'].includes(layer.fontFamily)) throw new Error('Pisava logotipa ni podprta.');
  if (layer.fontFamily === 'Noto Sans' && (layer.fontStyle !== 'normal' || ![400, 700].includes(layer.fontWeight))) throw new Error('Izbrana pisava Noto Sans ni vključena.');
  const file = layer.fontFamily === 'Noto Sans' ? `NotoSans-${layer.fontWeight >= 600 ? 'Bold' : 'Regular'}.ttf` : `${layer.fontFamily}-${layer.fontWeight}-${layer.fontStyle}.ttf`;
  if (!fonts.has(file)) fonts.set(file, readFile(path.join(process.cwd(), 'public', 'fonts', file)).then(bytes => fontkit.create(bytes) as Font));
  return fonts.get(file)!;
}

export async function logoTextMetrics(layer: Pick<LogoTextLayer, 'fontFamily' | 'fontWeight' | 'fontStyle' | 'fontSize'>) {
  const font = await fontFor(layer);
  return { ascent: font.ascent * layer.fontSize / font.unitsPerEm, descent: font.descent * layer.fontSize / font.unitsPerEm };
}

async function textPaths(layer: LogoTextLayer): Promise<string> {
  const font = await fontFor(layer), scale = layer.fontSize / font.unitsPerEm;
  const shear = 0;
  return layer.text.split('\n').map((line, lineIndex) => {
    // Browsers disable optional ligatures for explicit character spacing.
    const run = font.layout(line, layer.letterSpacing === 0 ? undefined : { liga: false, clig: false });
    const width = run.positions.reduce((sum, p) => sum + p.xAdvance * scale, 0) + Math.max(0, run.glyphs.length - 1) * layer.letterSpacing;
    let x = layer.textAlign === 'center' ? (layer.width - width) / 2 : layer.textAlign === 'right' ? layer.width - width : 0;
    const baseline = font.ascent * scale + lineIndex * layer.fontSize * layer.lineHeight;
    return run.glyphs.map((glyph, i) => {
      const pos = run.positions[i], gx = x + pos.xOffset * scale, gy = baseline - pos.yOffset * scale;
      x += pos.xAdvance * scale + layer.letterSpacing;
      return `<path d="${xml(glyph.path.toSVG())}" transform="translate(${n(gx)} ${n(gy)}) matrix(${n(scale)} 0 ${n(shear * scale)} ${n(-scale)} 0 0)"/>`;
    }).join('');
  }).join('');
}

/** Local artwork bounds for a filter region, including children outside a group frame. */
async function contentBounds(layer: LogoLayer): Promise<LogoBounds> {
  if (layer.type === 'group') {
    const children = await Promise.all(layer.children.filter(child => child.visible).map(async child => {
      let b = await contentBounds(child);
      if (child.shadow) b = shadowBounds(b, child.shadow);
      // Rotate bounds around the child's actual frame centre, not the ink centre.
      const rotated = logoLayerBounds({ ...child, x: 0, y: 0, width: b.width, height: b.height });
      const angle = child.rotation * Math.PI / 180, cx = b.x + b.width / 2 - child.width / 2, cy = b.y + b.height / 2 - child.height / 2;
      return { ...rotated, x: child.x + child.width / 2 + cx * Math.cos(angle) - cy * Math.sin(angle) - rotated.width / 2, y: child.y + child.height / 2 + cx * Math.sin(angle) + cy * Math.cos(angle) - rotated.height / 2 };
    }));
    return unionLogoBounds(children) ?? { x: 0, y: 0, width: layer.width, height: layer.height };
  }
  if (layer.type === 'text') {
    const font = await fontFor(layer), scale = layer.fontSize / font.unitsPerEm, boxes: LogoBounds[] = [];
    for (const [lineIndex, line] of layer.text.split('\n').entries()) {
      const run = font.layout(line, layer.letterSpacing === 0 ? undefined : { liga: false, clig: false });
      const width = run.positions.reduce((sum, p) => sum + p.xAdvance * scale, 0) + Math.max(0, run.glyphs.length - 1) * layer.letterSpacing;
      let x = layer.textAlign === 'center' ? (layer.width - width) / 2 : layer.textAlign === 'right' ? layer.width - width : 0;
      const baseline = font.ascent * scale + lineIndex * layer.fontSize * layer.lineHeight;
      for (const [i, glyph] of run.glyphs.entries()) {
        const pos = run.positions[i], box = glyph.bbox;
        if (box.width > 0 && box.height > 0) boxes.push({ x: x + (pos.xOffset + box.minX) * scale, y: baseline - (pos.yOffset + box.maxY) * scale, width: box.width * scale, height: box.height * scale });
        x += pos.xAdvance * scale + layer.letterSpacing;
      }
    }
    return unionLogoBounds(boxes) ?? { x: 0, y: 0, width: layer.width, height: layer.height };
  }
  const pad = layer.type === 'shape' && layer.stroke !== 'none' ? layer.strokeWidth / 2 : 0;
  return { x: -pad, y: -pad, width: layer.width + pad * 2, height: layer.height + pad * 2 };
}
function shadowBounds(bounds: LogoBounds, shadow: NonNullable<LogoLayer['shadow']>): LogoBounds {
  const spread = shadow.blur * 2 + 2; // Four standard deviations and an antialiasing margin.
  const left = Math.min(0, shadow.offsetX) - spread, top = Math.min(0, shadow.offsetY) - spread;
  return { x: bounds.x + left, y: bounds.y + top, width: bounds.width + Math.abs(shadow.offsetX) + spread * 2, height: bounds.height + Math.abs(shadow.offsetY) + spread * 2 };
}

async function alphaBounds(input: Buffer): Promise<LogoBounds> {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * info.channels + info.channels - 1] > 0) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

async function parseSafeSvg(bytes: Uint8Array) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/iu.test(source)) throw new Error('SVG ne sme vsebovati zunanjih deklaracij.');
  const errors: string[] = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } }).parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || errors.length) throw new Error('Datoteka ni veljaven SVG.');
  let count = 0, paths = 0;
  const embedded: Buffer[] = [];
  const walk = (el: XmlElement, depth: number) => {
    if (++count > 5000 || depth > 32) throw new Error('SVG je preveč zapleten.');
    const tag = (el.localName ?? el.nodeName).toLowerCase();
    if (['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'animate', 'animatetransform', 'animatemotion', 'set'].includes(tag)) throw new Error('SVG vsebuje nedovoljen aktivni element.');
    if (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('Imenski prostor SVG ni dovoljen.');
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i)!;
      if (/^on/iu.test(a.localName ?? a.name) || /(?:javascript|vbscript)\s*:/iu.test(a.value)) throw new Error('SVG ne sme vsebovati skript ali dogodkov.');
      if (a.localName === 'href' && a.value && !a.value.startsWith('#')) {
        const data = tag === 'image' ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/u.exec(a.value) : null;
        if (!data) throw new Error('SVG ne sme vsebovati zunanjih povezav.');
        const decoded = Buffer.from(data[2], 'base64');
        signature(decoded, data[1] as LogoSourceAsset['mimeType']);
        embedded.push(decoded);
      }
      if (/@import|@font-face|expression\s*\(/iu.test(a.value) || (a.localName === 'style' && a.value.includes('\\'))) throw new Error('SVG vsebuje nedovoljen slog.');
      for (const m of a.value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/giu)) if (!m[2].trim().startsWith('#')) throw new Error('SVG ne sme nalagati zunanjih virov.');
      if (a.localName === 'd') { paths += a.value.length; if (paths > 500_000) throw new Error('SVG vsebuje preveč podatkov poti.'); }
    }
    if (tag === 'style' && (/@import|@font-face|expression\s*\(|url\s*\(/iu.test(el.textContent ?? '') || (el.textContent ?? '').includes('\\'))) throw new Error('SVG vsebuje nedovoljen zunanji slog.');
    for (let child = el.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) walk(child as XmlElement, depth + 1);
  };
  walk(root, 0);
  let embeddedPixels = 0;
  for (const image of embedded) {
    const metadata = await sharp(image, { limitInputPixels: MAX_PIXELS }).metadata();
    dimensions(metadata.width ?? 0, metadata.height ?? 0);
    if ((metadata.pages ?? 1) !== 1) throw new Error('Animirane slike v SVG niso podprte.');
    embeddedPixels += (metadata.width ?? 0) * (metadata.height ?? 0);
    if (embeddedPixels > 32_000_000) throw new Error('Vdelane slike SVG presegajo dovoljeno velikost.');
  }
  return root;
}

function signature(bytes: Uint8Array, mime: LogoSourceAsset['mimeType']) {
  if (bytes.byteLength < 8 || bytes.byteLength > MAX_BYTES) throw new Error('Slika je prazna ali večja od 10 MB.');
  const p = Buffer.from(bytes.subarray(0, 12));
  const valid = mime === 'image/png' ? p.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mime === 'image/jpeg' ? p[0] === 255 && p[1] === 216 && p[2] === 255 : mime === 'image/webp' ? p.toString('ascii', 0, 4) === 'RIFF' && p.toString('ascii', 8, 12) === 'WEBP' : mime === 'image/svg+xml';
  if (!valid) throw new Error('Vsebina se ne ujema z vrsto slike.');
}

export async function renderLogoProject(project: LogoProject, assets: LogoSourceAsset[], resolveAsset: LogoAssetResolver) {
  project = validateLogoProject(project, assets);
  dimensions(project.canvas.width, project.canvas.height, 2);
  const width = Math.round(project.canvas.width), height = Math.round(project.canvas.height);
  const byId = new Map(assets.map(asset => [asset.id, asset])), resolved = new Map<string, Promise<string>>();
  let sequence = 0, count = 0, sourcePixels = 0, sourceBytes = 0;
  const defs: string[] = [];
  const imageData = (id: string): Promise<string> => {
    if (!resolved.has(id)) resolved.set(id, (async () => {
      const asset = byId.get(id); if (!asset) throw new Error('Izvorna slika plasti ne obstaja.');
      sourcePixels += asset.width * asset.height; sourceBytes += asset.bytes;
      if (sourcePixels > 32_000_000 || sourceBytes > 32 * 1024 * 1024) throw new Error('Skupna velikost izvornih slik presega omejitev enega logotipa.');
      const bytes = await resolveAsset(asset); signature(bytes, asset.mimeType);
      if (asset.mimeType === 'image/svg+xml') await parseSafeSvg(bytes);
      const png = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().png().toBuffer();
      const sourceId = 'source-' + id;
      defs.push(`<image id="${xml(sourceId)}" href="data:image/png;base64,${png.toString('base64')}" width="1" height="1" preserveAspectRatio="none"/>`);
      return sourceId;
    })());
    return resolved.get(id)!;
  };
  const draw = async (layer: LogoLayer, depth = 0): Promise<string> => {
    if (++count > 200 || depth > 16) throw new Error('Logotip vsebuje preveč plasti.');
    if (!layer.visible || layer.opacity <= 0) return '';
    for (const v of [layer.x, layer.y, layer.width, layer.height, layer.rotation, layer.opacity]) if (!Number.isFinite(v)) throw new Error('Geometrija plasti ni veljavna.');
    const id = `logo-${++sequence}`;
    let filter = '';
    if (layer.shadow && layer.shadow.opacity > 0) {
      const s = layer.shadow;
      const region = shadowBounds(await contentBounds(layer), s);
      defs.push(`<filter id="${id}-shadow" filterUnits="userSpaceOnUse" x="${n(region.x)}" y="${n(region.y)}" width="${n(region.width)}" height="${n(region.height)}" color-interpolation-filters="sRGB"><feDropShadow dx="${n(s.offsetX)}" dy="${n(s.offsetY)}" stdDeviation="${n(s.blur / 2)}" flood-color="${color(s.color)}" flood-opacity="${n(s.opacity)}"/></filter>`);
      filter = ` filter="url(#${id}-shadow)"`;
    }
    let body: string;
    if (layer.type === 'group') body = (await Promise.all(layer.children.map(child => draw(child, depth + 1)))).join('');
    else if (layer.type === 'text') body = `<g fill="${color(layer.fill)}">${await textPaths(layer)}</g>`;
    else if (layer.type === 'image') {
      const c = layer.crop;
      if (c.width <= 0 || c.height <= 0 || c.x < 0 || c.y < 0 || c.x + c.width > 1.000001 || c.y + c.height > 1.000001) throw new Error('Izrez slike ni veljaven.');
      defs.push(`<clipPath id="${id}-clip">${layer.mask === 'ellipse' ? `<ellipse cx="${layer.width / 2}" cy="${layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}"/>` : `<rect width="${layer.width}" height="${layer.height}"/>`}</clipPath>`);
      body = `<g clip-path="url(#${id}-clip)"><use href="#${await imageData(layer.assetId)}" transform="translate(${n(-c.x * layer.width / c.width)} ${n(-c.y * layer.height / c.height)}) scale(${n(layer.width / c.width)} ${n(layer.height / c.height)})"/></g>`;
    } else {
      const style = `fill="${color(layer.fill)}" stroke="${color(layer.stroke)}" stroke-width="${n(layer.strokeWidth)}"`;
      body = layer.shape === 'ellipse' ? `<ellipse cx="${layer.width / 2}" cy="${layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" ${style}/>` : layer.shape === 'line' ? `<line x1="0" y1="0" x2="${layer.width}" y2="${layer.height}" ${style}/>` : layer.shape === 'path' ? (() => {
        const v = layer.pathViewBox ?? { x: 0, y: 0, width: layer.width, height: layer.height };
        if (v.width <= 0 || v.height <= 0) throw new Error('Mere poti niso veljavne.');
        return `<g transform="scale(${n(layer.width / v.width)} ${n(layer.height / v.height)}) translate(${n(-v.x)} ${n(-v.y)})"><path d="${xml(layer.path ?? '')}" ${style}/></g>`;
      })() : `<rect width="${layer.width}" height="${layer.height}" rx="${n(layer.radius)}" ${style}/>`;
    }
    return `<g transform="translate(${n(layer.x)} ${n(layer.y)}) rotate(${n(layer.rotation)} ${n(layer.width / 2)} ${n(layer.height / 2)})" opacity="${n(layer.opacity)}"${filter}>${body}</g>`;
  };
  const content = (await Promise.all(project.layers.map(layer => draw(layer)))).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.sort().join('')}</defs>${content}</svg>`;
  const [png, png2x] = await Promise.all([sharp(Buffer.from(svg), { limitInputPixels: MAX_PIXELS }).png().toBuffer(), sharp(Buffer.from(svg), { density: 144, limitInputPixels: MAX_PIXELS }).png().toBuffer()]);
  return { png, png2x, svg, width, height, bounds: await alphaBounds(png) };
}

const scalar = (el: XmlElement, key: string, fallback = 0) => {
  const raw = el.getAttribute(key);
  if (!raw) return fallback;
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:px)?$/u.test(raw.trim())) throw new Error('SVG uporablja relativne ali nepodprte mere.');
  return Number.parseFloat(raw);
};

async function svgProject(root: XmlElement, width: number, height: number): Promise<LogoProject> {
  let sequence = 0;
  const view = (root.getAttribute('viewBox') ?? `0 0 ${width} ${height}`).trim().split(/[\s,]+/u).map(Number);
  if (view.length !== 4 || view.some(v => !Number.isFinite(v)) || view[2] !== width || view[3] !== height || view[0] || view[1]) throw new Error('SVG uporablja dodatno preslikavo platna.');
  const inherit = ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing'];
  const allowedAttributes = new Set([...inherit, 'id', 'xmlns', 'version', 'viewBox', 'width', 'height', 'opacity', 'display', 'visibility', 'transform', 'style', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points']);
  const convert = async (el: XmlElement, inherited: Record<string, string>): Promise<LogoLayer[]> => {
    const tag = el.localName ?? el.nodeName;
    if (tag === 'svg' && el !== root) throw new Error('Vgnezdeno platno SVG ostane v sliki.');
    if (['title', 'desc', 'metadata'].includes(tag)) return [];
    if (!['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'text'].includes(tag)) throw new Error('Element SVG ostane združen v sliki.');
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i)!;
      if (!allowedAttributes.has(a.name) && !a.name.startsWith('data-') && !a.name.startsWith('aria-') && !a.name.startsWith('xmlns:')) throw new Error('Lastnost SVG zahteva združeno sliko.');
    }
    const style = { ...inherited };
    for (const key of inherit) if (el.hasAttribute(key)) style[key] = el.getAttribute(key)!;
    for (const part of (el.getAttribute('style') ?? '').split(';')) {
      if (!part.trim()) continue;
      const [key, ...rest] = part.split(':');
      if (!inherit.includes(key.trim()) && !['opacity', 'display', 'visibility'].includes(key.trim())) throw new Error('Slog SVG zahteva združeno sliko.');
      style[key.trim()] = rest.join(':').trim();
    }
    let tx = 0, ty = 0;
    const transform = el.getAttribute('transform');
    if (transform) {
      const m = /^translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)$/u.exec(transform);
      if (!m) throw new Error('Preslikava SVG zahteva združeno sliko.');
      tx = Number(m[1]); ty = Number(m[2] ?? 0);
    }
    const base = { id: `import-${++sequence}`, name: el.getAttribute('id') || tag, x: tx, y: ty, width, height, rotation: 0, opacity: Number(style.opacity ?? el.getAttribute('opacity') ?? 1), visible: style.display !== 'none' && el.getAttribute('display') !== 'none' && style.visibility !== 'hidden' && el.getAttribute('visibility') !== 'hidden', locked: false };
    if (tag === 'svg' || tag === 'g') {
      const children: LogoLayer[] = [];
      const childStyle = Object.fromEntries(inherit.filter(k => style[k] !== undefined).map(k => [k, style[k]]));
      for (let node = el.firstChild; node; node = node.nextSibling) if (node.nodeType === 1) children.push(...await convert(node as XmlElement, childStyle));
      return [{ ...base, type: 'group', children }];
    }
    if (tag === 'text') {
      if (/\s{2,}|[\r\n\t]/u.test(el.textContent ?? '') || (style.stroke && style.stroke !== 'none')) throw new Error('Oblikovanje besedila SVG zahteva združeno sliko.');
      for (let node = el.firstChild; node; node = node.nextSibling) if (node.nodeType === 1) throw new Error('Razčlenjeno besedilo SVG ostane v sliki.');
      const family = (style['font-family'] ?? '').replace(/['"]/gu, '');
      if (!['Inter', 'Barlow', 'Bitter', 'Noto Sans'].includes(family)) throw new Error('Pisava SVG ni med vključenimi pisavami.');
      const fontSize = Number(style['font-size'] ?? 16), fontWeight = Number(style['font-weight'] ?? 400), fontStyle = style['font-style'] ?? 'normal';
      if (![400, 500, 600, 700].includes(fontWeight) || !['normal', 'italic'].includes(fontStyle) || !Number.isFinite(fontSize) || (family === 'Noto Sans' && (fontStyle !== 'normal' || ![400, 700].includes(fontWeight)))) throw new Error('Pisava SVG zahteva združeno sliko.');
      const fontFamily = family as LogoTextLayer['fontFamily'];
      const face = { fontFamily, fontWeight: fontWeight as LogoTextLayer['fontWeight'], fontStyle: fontStyle as LogoTextLayer['fontStyle'] };
      const font = await fontFor(face);
      const anchor = style['text-anchor'] ?? 'start';
      if (!['start', 'middle', 'end'].includes(anchor)) throw new Error('Poravnava SVG ni podprta.');
      return [{ ...base, type: 'text', ...face, x: tx + scalar(el, 'x') - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0), y: ty + scalar(el, 'y') - font.ascent * fontSize / font.unitsPerEm, width, height: fontSize * 1.2, text: el.textContent ?? '', fontSize, fill: color(style.fill ?? '#000000'), textAlign: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', lineHeight: 1.2, letterSpacing: Number(style['letter-spacing'] ?? 0) }];
    }
    const common = { ...base, type: 'shape' as const, fill: color(style.fill ?? '#000000'), stroke: color(style.stroke ?? 'none'), strokeWidth: Number(style['stroke-width'] ?? 1), radius: 0 };
    if (tag === 'rect') {
      if (el.hasAttribute('ry') && scalar(el, 'ry') !== scalar(el, 'rx')) throw new Error('Ovinek SVG zahteva združeno sliko.');
      return [{ ...common, shape: 'rectangle', x: tx + scalar(el, 'x'), y: ty + scalar(el, 'y'), width: scalar(el, 'width'), height: scalar(el, 'height'), radius: scalar(el, 'rx') }];
    }
    if (tag === 'circle' || tag === 'ellipse') {
      const rx = scalar(el, tag === 'circle' ? 'r' : 'rx'), ry = scalar(el, tag === 'circle' ? 'r' : 'ry');
      return [{ ...common, shape: 'ellipse', x: tx + scalar(el, 'cx') - rx, y: ty + scalar(el, 'cy') - ry, width: rx * 2, height: ry * 2 }];
    }
    const d = tag === 'path' ? el.getAttribute('d') ?? '' : tag === 'line' ? `M ${scalar(el, 'x1')} ${scalar(el, 'y1')} L ${scalar(el, 'x2')} ${scalar(el, 'y2')}` : `M ${el.getAttribute('points') ?? ''}${tag === 'polygon' ? ' Z' : ''}`;
    return [{ ...common, shape: 'path', path: d, pathViewBox: { x: 0, y: 0, width, height } }];
  };
  return { version: 1, canvas: { width, height }, layers: await convert(root, {}) };
}

export async function decodeLogoImport(bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType']): Promise<DecodedLogoImport> {
  signature(bytes, mimeType);
  const root = mimeType === 'image/svg+xml' ? await parseSafeSvg(bytes) : null;
  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS });
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) !== 1) throw new Error('Animirane slike niso podprte.');
  const raster = await image.rotate().png().toBuffer();
  const oriented = await sharp(raster).metadata();
  const width = oriented.width ?? 0, height = oriented.height ?? 0;
  dimensions(width, height);
  const result: DecodedLogoImport = { width, height, bounds: await alphaBounds(raster), warnings: [] };
  if (root) {
    if (root.getElementsByTagName('image').length) result.warnings.push('SVG vsebuje vdelane rastrske slike.');
    try { result.project = await svgProject(root, width, height); }
    catch { result.warnings.push('SVG vsebuje nepodprte elemente, preslikave ali pisave. Uvožen je kot ena slikovna plast; izvirnik je ohranjen.'); }
  } else result.warnings.push('Naložena slika je ena plast. Besedilo in znak nista samodejno ločena; dodate lahko nove besedilne plasti.');
  return result;
}

export async function inspectLogoSource(bytes: Uint8Array, mimeType: LogoSourceAsset['mimeType']) {
  const result = await decodeLogoImport(bytes, mimeType);
  return { width: result.width, height: result.height, bounds: result.bounds, warnings: result.warnings };
}


