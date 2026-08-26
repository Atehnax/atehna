import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { head } from '@vercel/blob';
import sharp from 'sharp';
import {
  DEFAULT_SITE_LOGO_TEXT_LAYERS,
  SITE_LOGO_BUILTIN_MASK_URLS,
  SITE_LOGO_BUILTIN_ORIGINAL_MASTER,
  SITE_LOGO_TEXT_MASK_BOUNDS,
  SITE_LOGO_TAGLINE_BAND_RATIO,
  isBuiltInAtehnaLogoMaster,
  isDefaultSiteLogoPresentation,
  isTrustedSiteLogoMasterSource,
  resolveSiteLogoCanvasLayout,
  resolveSiteLogoMaster,
  resolveSiteLogoPresentation,
  resolveSiteLogoTransparentColors,
  usesCanonicalSiteLogoTextMask,
  type SiteLogoCanvasLayout,
  type SiteLogoConfig,
  type SiteLogoMasterVariant,
  type SiteLogoPresentation,
  type SiteLogoTextLayer,
  type SiteLogoTextLayerId,
  type SiteLogoPurposeId
} from '@/shared/domain/logo/siteLogo';

type Rgb = [number, number, number];

export const SITE_LOGO_MAX_SOURCE_DIMENSION = 8192;
export const SITE_LOGO_MAX_SOURCE_PIXELS = 16_000_000;
export const SITE_LOGO_MAX_CANVAS_PIXELS = 16_000_000;
export const SITE_LOGO_MAX_CANVAS_RAW_BYTES = SITE_LOGO_MAX_CANVAS_PIXELS * 4;
export const SITE_LOGO_MAX_EFFECT_WORKSPACE_PIXELS = 24_000_000;

export type ResolvedSiteLogoArtwork = {
  bytes: Uint8Array;
  format: 'png';
  intrinsicWidth: number;
  intrinsicHeight: number;
  master: SiteLogoMasterVariant;
  presentation: SiteLogoPresentation;
};

const MASK_KEYS = ['artwork', 'primary', 'secondary', 'tagline'] as const;
type MaskKey = (typeof MASK_KEYS)[number];
type LoadedMaskSet = Record<MaskKey, Buffer> & { width: number; height: number };
let maskSetPromise: Promise<LoadedMaskSet> | null = null;

function publicPath(urlPath: string) {
  return path.join(process.cwd(), 'public', urlPath.replace(/^\/+/, ''));
}

function color(value: string): Rgb {
  const hex = /^#[0-9A-F]{6}$/iu.test(value) ? value.slice(1) : '000000';
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16)
  ];
}

async function loadMaskSet(): Promise<LoadedMaskSet> {
  if (maskSetPromise) return maskSetPromise;
  maskSetPromise = (async () => {
    const masks = {} as Record<MaskKey, Buffer>;
    let width = 0;
    let height = 0;
    for (const key of MASK_KEYS) {
      const result = await sharp(publicPath(SITE_LOGO_BUILTIN_MASK_URLS[key]))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      width ||= result.info.width;
      height ||= result.info.height;
      if (result.info.width !== width || result.info.height !== height || result.info.channels !== 4) {
        throw new Error('ATEHNA logo mask dimensions are inconsistent.');
      }
      const alpha = Buffer.alloc(width * height);
      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = result.data[index * 4 + 3];
      }
      masks[key] = alpha;
    }
    return Object.assign(masks, { width, height });
  })();
  return maskSetPromise;
}

function solidBackground(
  width: number,
  height: number,
  top: Rgb | null,
  bottom: Rgb | null,
  split: number
) {
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const fill = y < split ? top : bottom;
    if (!fill) continue;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      output[offset] = fill[0];
      output[offset + 1] = fill[1];
      output[offset + 2] = fill[2];
      output[offset + 3] = 255;
    }
  }
  return output;
}

export function assertSiteLogoRasterBudget(
  sourceWidth: number,
  sourceHeight: number,
  canvasLayout: SiteLogoCanvasLayout
) {
  if (
    !Number.isInteger(sourceWidth)
    || !Number.isInteger(sourceHeight)
    || sourceWidth < 1
    || sourceHeight < 1
    || sourceWidth > SITE_LOGO_MAX_SOURCE_DIMENSION
    || sourceHeight > SITE_LOGO_MAX_SOURCE_DIMENSION
    || sourceWidth * sourceHeight > SITE_LOGO_MAX_SOURCE_PIXELS
  ) {
    throw new Error('Site logo source dimensions exceed the safe raster budget.');
  }
  const canvasPixels = canvasLayout.width * canvasLayout.height;
  if (
    !Number.isInteger(canvasLayout.width)
    || !Number.isInteger(canvasLayout.height)
    || canvasLayout.width < 1
    || canvasLayout.height < 1
    || !Number.isSafeInteger(canvasPixels)
    || canvasPixels < 1
    || canvasPixels > SITE_LOGO_MAX_CANVAS_PIXELS
    || canvasPixels * 4 > SITE_LOGO_MAX_CANVAS_RAW_BYTES
  ) {
    throw new Error('Site logo canvas dimensions exceed the safe raster budget.');
  }
}

function siteLogoEffectPadding(presentation: SiteLogoPresentation) {
  const outlinePadding = presentation.outline.enabled
    ? Math.ceil(presentation.outline.widthPx) + 2
    : 0;
  const shadowPadding = presentation.shadow.enabled && presentation.shadow.opacity > 0
    ? Math.ceil(
        presentation.shadow.blurPx * 3
        + Math.max(Math.abs(presentation.shadow.offsetXpx), Math.abs(presentation.shadow.offsetYpx))
      ) + 2
    : 0;
  return Math.max(outlinePadding, shadowPadding);
}

function assertSiteLogoEffectWorkspaceBudget(
  canvasLayout: SiteLogoCanvasLayout,
  presentation: SiteLogoPresentation
) {
  const padding = siteLogoEffectPadding(presentation);
  const width = canvasLayout.width + padding * 2;
  const height = canvasLayout.height + padding * 2;
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels < 1 || pixels > SITE_LOGO_MAX_EFFECT_WORKSPACE_PIXELS) {
    throw new Error('Site logo effect workspace exceeds the safe raster budget.');
  }
  return { padding, width, height };
}

function coloredMask(
  mask: Buffer,
  width: number,
  height: number,
  fill: Rgb,
  opacity = 1,
  offsetX = 0,
  offsetY = 0
) {
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < width; x += 1) {
      const targetX = x + offsetX;
      if (targetX < 0 || targetX >= width) continue;
      const alpha = Math.round(mask[y * width + x] * opacity);
      if (alpha === 0) continue;
      const offset = (targetY * width + targetX) * 4;
      output[offset] = fill[0];
      output[offset + 1] = fill[1];
      output[offset + 2] = fill[2];
      output[offset + 3] = alpha;
    }
  }
  return output;
}

function mergeAlphaMasks(width: number, height: number, masks: readonly Buffer[]) {
  const output = Buffer.alloc(width * height);
  for (const mask of masks) {
    for (let index = 0; index < output.length; index += 1) {
      if (mask[index] > output[index]) output[index] = mask[index];
    }
  }
  return output;
}

function placeAlphaMask(
  source: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  left: number,
  top: number
) {
  const output = Buffer.alloc(targetWidth * targetHeight);
  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = top + y;
    if (targetY < 0 || targetY >= targetHeight) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = left + x;
      if (targetX < 0 || targetX >= targetWidth) continue;
      output[targetY * targetWidth + targetX] = source[y * sourceWidth + x];
    }
  }
  return output;
}

function placeRgba(
  source: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  left: number,
  top: number
) {
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < sourceHeight; y += 1) {
    const targetY = top + y;
    if (targetY < 0 || targetY >= targetHeight) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const targetX = left + x;
      if (targetX < 0 || targetX >= targetWidth) continue;
      const sourceOffset = (y * sourceWidth + x) * 4;
      const targetOffset = (targetY * targetWidth + targetX) * 4;
      source.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return output;
}

async function transformedCanonicalTextMask(
  source: Buffer,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  sourceLeft: number,
  sourceTop: number,
  layerId: SiteLogoTextLayerId,
  layer: SiteLogoTextLayer
) {
  const fallback = DEFAULT_SITE_LOGO_TEXT_LAYERS[layerId];
  const bounds = SITE_LOGO_TEXT_MASK_BOUNDS[layerId];
  if (
    layer.x === fallback.x
    && layer.y === fallback.y
    && layer.fontSizePx === fallback.fontSizePx
    && layer.textAlign === 'left'
  ) return placeAlphaMask(
    source,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    sourceLeft,
    sourceTop
  );

  const scale = layer.fontSizePx / fallback.fontSizePx;
  const resizedWidth = Math.max(1, Math.round(bounds.width * scale));
  const resizedHeight = Math.max(1, Math.round(bounds.height * scale));
  const anchorFactor = layer.textAlign === 'center' ? 0.5 : layer.textAlign === 'right' ? 1 : 0;
  const cropped = await sharp(source, { raw: { width: sourceWidth, height: sourceHeight, channels: 1 } })
    .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
    .resize(resizedWidth, resizedHeight, { fit: 'fill', kernel: 'lanczos3' })
    .extractChannel(0)
    .raw()
    .toBuffer();
  return placeAlphaMask(
    cropped,
    resizedWidth,
    resizedHeight,
    targetWidth,
    targetHeight,
    sourceLeft + Math.round(layer.x * sourceWidth - resizedWidth * anchorFactor),
    sourceTop + Math.round(layer.y * sourceHeight)
  );
}

function escapePangoText(value: string) {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function siteLogoTextFontFile(layer: SiteLogoTextLayer) {
  if (layer.fontFamily === 'Noto Sans') {
    return publicPath(layer.fontWeight >= 600 ? '/fonts/NotoSans-Bold.ttf' : '/fonts/NotoSans-Regular.ttf');
  }
  return publicPath(`/fonts/Barlow-${layer.fontWeight}-${layer.fontStyle}.ttf`);
}

async function dynamicTextMask(
  canvasWidth: number,
  canvasHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  sourceLeft: number,
  sourceTop: number,
  layer: SiteLogoTextLayer
) {
  if (!layer.content) return Buffer.alloc(canvasWidth * canvasHeight);
  const markup = `<span letter_spacing="${Math.round(layer.letterSpacingPx * 1024)}">${escapePangoText(layer.content)}</span>`;
  const rendered = await sharp({
    text: {
      text: markup,
      font: `${layer.fontFamily} ${layer.fontStyle} ${layer.fontWeight} ${layer.fontSizePx}`,
      fontfile: siteLogoTextFontFile(layer),
      rgba: true,
      dpi: 72
    }
  })
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(rendered.info.width * rendered.info.height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rendered.data[index * rendered.info.channels + 3];
  }
  const glyphHeight = Math.max(1, Math.round(layer.fontSizePx));
  const glyphWidth = Math.max(1, Math.round(rendered.info.width * glyphHeight / rendered.info.height));
  const anchorFactor = layer.textAlign === 'center' ? 0.5 : layer.textAlign === 'right' ? 1 : 0;
  const resized = await sharp(alpha, {
    raw: { width: rendered.info.width, height: rendered.info.height, channels: 1 }
  }).resize(glyphWidth, glyphHeight, { fit: 'fill', kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  return placeAlphaMask(
    resized,
    glyphWidth,
    glyphHeight,
    canvasWidth,
    canvasHeight,
    sourceLeft + Math.round(layer.x * sourceWidth - glyphWidth * anchorFactor),
    sourceTop + Math.round(layer.y * sourceHeight)
  );
}

async function builtInTextLayerMask(
  masks: LoadedMaskSet,
  layerId: SiteLogoTextLayerId,
  layer: SiteLogoTextLayer,
  targetWidth: number,
  targetHeight: number,
  sourceLeft: number,
  sourceTop: number
) {
  if (!layer.enabled) return Buffer.alloc(targetWidth * targetHeight);
  const source = layerId === 'secondaryText' ? masks.secondary : masks.tagline;
  return usesCanonicalSiteLogoTextMask(layer, layerId)
    ? transformedCanonicalTextMask(
        source,
        masks.width,
        masks.height,
        targetWidth,
        targetHeight,
        sourceLeft,
        sourceTop,
        layerId,
        layer
      )
    : dynamicTextMask(
        targetWidth,
        targetHeight,
        masks.width,
        masks.height,
        sourceLeft,
        sourceTop,
        layer
      );
}

async function effectLayers(
  mask: Buffer,
  width: number,
  height: number,
  presentation: SiteLogoPresentation
) {
  const layers: Array<{ input: Buffer; raw: { width: number; height: number; channels: 4 } }> = [];
  const raw = { width, height, channels: 4 as const };
  if (presentation.shadow.enabled && presentation.shadow.opacity > 0) {
    const shadowMask = presentation.shadow.blurPx > 0
      ? await sharp(mask, { raw: { width, height, channels: 1 } })
          .blur(Math.max(0.3, presentation.shadow.blurPx))
          .extractChannel(0)
          .raw()
          .toBuffer()
      : mask;
    layers.push({
      input: coloredMask(
        shadowMask,
        width,
        height,
        color(presentation.shadow.color),
        presentation.shadow.opacity,
        Math.round(presentation.shadow.offsetXpx),
        Math.round(presentation.shadow.offsetYpx)
      ),
      raw
    });
  }
  if (presentation.outline.enabled && presentation.outline.widthPx > 0) {
    const outlineMask = await sharp(mask, { raw: { width, height, channels: 1 } })
      // For this single-channel alpha mask, erode expands the non-zero
      // silhouette; dilate contracts it and leaves no border outside glyphs.
      .erode(Math.max(1, Math.round(presentation.outline.widthPx)))
      .extractChannel(0)
      .raw()
      .toBuffer();
    layers.push({ input: coloredMask(outlineMask, width, height, color(presentation.outline.color)), raw });
  }
  return layers;
}

export async function renderBuiltInAtehnaLogoArtwork(
  presentationInput?: SiteLogoPresentation
): Promise<Uint8Array> {
  const presentation = resolveSiteLogoPresentation({ presentation: presentationInput });
  if (isDefaultSiteLogoPresentation(presentation)) {
    return fs.readFile(publicPath(SITE_LOGO_BUILTIN_ORIGINAL_MASTER.url));
  }
  const masks = await loadMaskSet();
  const canvasLayout = resolveSiteLogoCanvasLayout(
    masks.width,
    masks.height,
    presentation.canvasEdges
  );
  assertSiteLogoRasterBudget(masks.width, masks.height, canvasLayout);
  const workspace = assertSiteLogoEffectWorkspaceBudget(canvasLayout, presentation);
  const transparent = resolveSiteLogoTransparentColors(presentation.transparentColors);
  const raw = { width: canvasLayout.width, height: canvasLayout.height, channels: 4 as const };
  const workspaceRaw = { width: workspace.width, height: workspace.height, channels: 4 as const };
  const workspaceSourceLeft = canvasLayout.sourceLeft + workspace.padding;
  const workspaceSourceTop = canvasLayout.sourceTop + workspace.padding;
  const background = solidBackground(
    canvasLayout.width,
    canvasLayout.height,
    transparent.background ? null : color(presentation.backgroundColor),
    transparent.taglineBackground ? null : color(presentation.taglineBackgroundColor),
    canvasLayout.sourceTop + Math.round(masks.height * SITE_LOGO_TAGLINE_BAND_RATIO)
  );
  const [secondaryTextMask, taglineTextMask] = await Promise.all([
    builtInTextLayerMask(
      masks,
      'secondaryText',
      presentation.secondaryText,
      workspace.width,
      workspace.height,
      workspaceSourceLeft,
      workspaceSourceTop
    ),
    builtInTextLayerMask(
      masks,
      'taglineText',
      presentation.taglineText,
      workspace.width,
      workspace.height,
      workspaceSourceLeft,
      workspaceSourceTop
    )
  ]);
  const placeInWorkspace = (mask: Buffer) => placeAlphaMask(
    mask,
    masks.width,
    masks.height,
    workspace.width,
    workspace.height,
    workspaceSourceLeft,
    workspaceSourceTop
  );
  const primaryWorkspaceMask = transparent.primary ? null : placeInWorkspace(masks.primary);
  const secondaryWorkspaceMask = transparent.secondary ? null : secondaryTextMask;
  const taglineWorkspaceMask = transparent.tagline ? null : taglineTextMask;
  const activeWorkspaceMasks: Buffer[] = [];
  if (primaryWorkspaceMask) activeWorkspaceMasks.push(primaryWorkspaceMask);
  if (secondaryWorkspaceMask) activeWorkspaceMasks.push(secondaryWorkspaceMask);
  if (taglineWorkspaceMask) activeWorkspaceMasks.push(taglineWorkspaceMask);
  const activeArtworkMask = mergeAlphaMasks(
    workspace.width,
    workspace.height,
    activeWorkspaceMasks
  );
  const workspaceLayers = await effectLayers(
    activeArtworkMask,
    workspace.width,
    workspace.height,
    presentation
  );
  if (primaryWorkspaceMask) {
    workspaceLayers.push({ input: coloredMask(primaryWorkspaceMask, workspace.width, workspace.height, color(presentation.primaryTextColor)), raw: workspaceRaw });
  }
  if (secondaryWorkspaceMask && presentation.secondaryText.enabled) {
    workspaceLayers.push({ input: coloredMask(secondaryWorkspaceMask, workspace.width, workspace.height, color(presentation.secondaryTextColor)), raw: workspaceRaw });
  }
  if (taglineWorkspaceMask && presentation.taglineText.enabled) {
    workspaceLayers.push({ input: coloredMask(taglineWorkspaceMask, workspace.width, workspace.height, color(presentation.taglineTextColor)), raw: workspaceRaw });
  }
  const layers = workspaceLayers.map((layer) => ({
    input: placeRgba(
      layer.input,
      workspace.width,
      workspace.height,
      canvasLayout.width,
      canvasLayout.height,
      -workspace.padding,
      -workspace.padding
    ),
    raw
  }));
  return sharp(background, { raw })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function bytesMatch(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function normalizeSvgSecuritySource(source: string) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  const decodedEntities = withoutComments
    .replace(/&#x([0-9a-f]+);?/giu, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '';
    })
    .replace(/&#([0-9]+);?/gu, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '';
    })
    .replace(/&(quot|apos|amp|lt|gt);/giu, (_match, entity: string) => ({
      quot: '\x22',
      apos: '\x27',
      amp: '&',
      lt: '<',
      gt: '>'
    })[entity.toLowerCase()] ?? '');
  const decodedCssEscapes = decodedEntities.replace(/\\([0-9a-f]{1,6})\s?/giu, (_match, hex: string) => {
    const codePoint = Number.parseInt(hex, 16);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '';
  });
  if (/\\/u.test(decodedCssEscapes)) {
    throw new Error('Uploaded SVG contains an unsupported escape sequence.');
  }
  return decodedCssEscapes;
}

function validateSvgLogoSource(bytes: Buffer) {
  if (bytes.byteLength > 2 * 1024 * 1024) {
    throw new Error('Uploaded SVG exceeds the 2 MB safe complexity limit.');
  }
  const source = normalizeSvgSecuritySource(bytes.toString('utf8').replace(/^\uFEFF/u, '').trim());
  if (!/<\s*(?:[a-z_][\w.-]*:)?svg\b/iu.test(source)) {
    throw new Error('Uploaded site logo is not a valid SVG document.');
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(source)) {
    throw new Error('Uploaded SVG must not declare a document type or entity.');
  }
  if (/<\?\s*xml-stylesheet\b/iu.test(source)) {
    throw new Error('Uploaded SVG must not load an XML stylesheet.');
  }
  if (/<\s*(?:[a-z_][\w.-]*:)?(?:script|foreignObject|iframe|object|embed|audio|video|animate|animateMotion|animateTransform|set|discard)\b/iu.test(source)) {
    throw new Error('Uploaded SVG contains active content.');
  }
  if (/\s(?:[a-z_][\w.-]*:)?base\s*=/iu.test(source) || /<\s*(?:[a-z_][\w.-]*:)?base\b/iu.test(source)) {
    throw new Error('Uploaded SVG must not redefine the base URL.');
  }
  if (/\s(?:[a-z_][\w.-]*:)?on[a-z][\w:.-]*\s*=/iu.test(source)) {
    throw new Error('Uploaded SVG contains an event handler.');
  }
  if (/@import\b/iu.test(source)) {
    throw new Error('Uploaded SVG must not import external CSS.');
  }
  const elementCount = (source.match(/<\s*(?![\/? !])(?:[a-z_][\w.-]*:)?[a-z_][\w.-]*\b/giu) ?? []).length;
  const useCount = (source.match(/<\s*(?:[a-z_][\w.-]*:)?use\b/giu) ?? []).length;
  const filterPrimitiveCount = (source.match(/<\s*(?:[a-z_][\w.-]*:)?fe[a-z]+\b/giu) ?? []).length;
  if (elementCount > 5000 || useCount > 1000 || filterPrimitiveCount > 256) {
    throw new Error('Uploaded SVG exceeds the safe element complexity limit.');
  }
  let pathDataLength = 0;
  const pathDataPattern = /\bd\s*=\s*([\x22'][^\x22']*[\x22']|[^\s>]+)/giu;
  for (const match of source.matchAll(pathDataPattern)) {
    pathDataLength += (match[1] ?? '').length;
    if (pathDataLength > 500_000) {
      throw new Error('Uploaded SVG exceeds the safe path complexity limit.');
    }
  }

  const hrefPattern = /\b(?:[a-z_][\w.-]*:)?href\s*=\s*([\x22'][^\x22']*[\x22']|[^\s>]+)/giu;
  for (const match of source.matchAll(hrefPattern)) {
    const rawHref = (match[1] ?? '').trim();
    const href = /^[\x22']/.test(rawHref) ? rawHref.slice(1, -1).trim() : rawHref;
    if (href && !href.startsWith('#')) {
      throw new Error('Uploaded SVG must not contain an external reference.');
    }
  }

  const cssUrlPattern = /url\(\s*([^)]*?)\s*\)/giu;
  for (const match of source.matchAll(cssUrlPattern)) {
    const rawTarget = (match[1] ?? '').trim();
    const target = /^[\x22']/.test(rawTarget) ? rawTarget.slice(1, -1).trim() : rawTarget;
    if (!target.startsWith('#')) {
      throw new Error('Uploaded SVG must not contain an external CSS URL.');
    }
  }
}

function validateClaimedLogoMime(bytes: Buffer, mimeType: SiteLogoMasterVariant['mimeType']) {
  if (mimeType === 'image/svg+xml') {
    validateSvgLogoSource(bytes);
    return;
  }
  const valid = mimeType === 'image/png'
    ? bytesMatch(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : mimeType === 'image/jpeg'
      ? bytesMatch(bytes, [0xff, 0xd8, 0xff])
      : mimeType === 'image/webp'
        ? bytes.subarray(0, 4).toString('ascii') === 'RIFF'
          && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
        : false;
  if (!valid) throw new Error('Uploaded site logo bytes do not match the declared image type.');
}

async function readResponseBodyWithLimit(response: Response, maximumBytes: number) {
  if (!response.body) throw new Error('Uploaded site logo response body is missing.');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        await reader.cancel();
        throw new Error('Uploaded site logo exceeds 10 MB.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, byteLength);
}

export async function validateSiteLogoMasterContent(master: SiteLogoMasterVariant) {
  if (!isTrustedSiteLogoMasterSource(master)) {
    throw new Error('Uploaded site logo does not point to the configured public logo store path.');
  }
  const storeId = process.env.PUBLIC_MEDIA_BLOB_STORE_ID?.trim();
  if (!storeId) throw new Error('PUBLIC_MEDIA_BLOB_STORE_ID is not set');
  const blob = await head(master.pathname, { storeId });
  if (
    blob.pathname !== master.pathname
    || blob.url !== master.url
    || blob.size !== master.size
    || blob.contentType !== master.mimeType
    || blob.size <= 0
    || blob.size > 10 * 1024 * 1024
  ) {
    throw new Error('Uploaded site logo metadata does not match the configured public blob store object.');
  }
  const response = await fetch(master.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
    cache: 'force-cache'
  });
  if (!response.ok) throw new Error(`Uploaded site logo could not be loaded (${response.status}).`);
  const responseType = (response.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase();
  if (responseType && responseType !== master.mimeType) {
    throw new Error('Uploaded site logo response type does not match its configured image type.');
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (
    !Number.isFinite(declaredLength)
    || declaredLength < 0
    || declaredLength > 10 * 1024 * 1024
    || (declaredLength > 0 && declaredLength !== blob.size)
  ) throw new Error('Uploaded site logo response size does not match its configured blob metadata.');
  const bytes = await readResponseBodyWithLimit(response, 10 * 1024 * 1024);
  if (bytes.byteLength !== blob.size) {
    throw new Error('Uploaded site logo response size does not match its configured blob metadata.');
  }
  validateClaimedLogoMime(bytes, master.mimeType);
  const metadata = await sharp(bytes, { limitInputPixels: SITE_LOGO_MAX_SOURCE_PIXELS }).metadata();
  const expectedFormat = master.mimeType === 'image/jpeg'
    ? 'jpeg'
    : master.mimeType === 'image/svg+xml' ? 'svg' : master.mimeType.slice('image/'.length);
  if (metadata.format !== expectedFormat) {
    throw new Error('Uploaded site logo decoder format does not match its configured image type.');
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new Error('Animated or multi-page site logos are not supported.');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const sourceLayout = resolveSiteLogoCanvasLayout(width, height, {});
  assertSiteLogoRasterBudget(width, height, sourceLayout);
  if (master.intrinsicWidth !== width || master.intrinsicHeight !== height) {
    throw new Error('Uploaded site logo dimensions do not match its configured metadata.');
  }
  return { bytes, width, height };
}

function siteLogoMasterContentFingerprint(master: SiteLogoMasterVariant) {
  return [
    master.url,
    master.pathname,
    master.mimeType,
    master.size,
    master.intrinsicWidth,
    master.intrinsicHeight
  ].join('|');
}

export async function validateSiteLogoConfigContent(
  config: SiteLogoConfig,
  previousConfig?: SiteLogoConfig | null
) {
  const previousById = new Map((previousConfig?.masters ?? []).map((master) => [master.id, master]));
  const referencedMasterIds = new Set(
    Object.values(config.placements)
      .filter((placement) => placement.enabled && placement.masterId)
      .map((placement) => placement.masterId!)
  );
  const mastersToValidate = config.masters.filter((master) => {
    const previous = previousById.get(master.id);
    return referencedMasterIds.has(master.id)
      || !previous
      || siteLogoMasterContentFingerprint(previous) !== siteLogoMasterContentFingerprint(master);
  });
  const validatedById = new Map<string, Awaited<ReturnType<typeof validateSiteLogoMasterContent>>>();
  // Decode sequentially so a valid but unusually large admin request cannot
  // multiply the per-image raster budget through concurrent allocations.
  for (const master of mastersToValidate) {
    validatedById.set(master.id, await validateSiteLogoMasterContent(master));
  }
  const configuredById = new Map(config.masters.map((master) => [master.id, master]));

  for (const placement of Object.values(config.placements)) {
    if (!placement.enabled || !placement.masterId) continue;
    const builtIn = isBuiltInAtehnaLogoMaster(placement.masterId);
    const configured = builtIn ? SITE_LOGO_BUILTIN_ORIGINAL_MASTER : configuredById.get(placement.masterId);
    if (!configured) throw new Error('Enabled site logo placement references a missing master.');
    const validated = builtIn ? null : validatedById.get(configured.id);
    if (!builtIn && !validated) {
      throw new Error('Enabled site logo master content was not validated.');
    }
    const width = validated?.width ?? configured.intrinsicWidth;
    const height = validated?.height ?? configured.intrinsicHeight;
    const presentation = resolveSiteLogoPresentation(placement);
    const canvasLayout = resolveSiteLogoCanvasLayout(width, height, presentation.canvasEdges);
    assertSiteLogoRasterBudget(width, height, canvasLayout);
    assertSiteLogoEffectWorkspaceBudget(canvasLayout, presentation);
  }
}

async function renderUploadedArtwork(
  source: Awaited<ReturnType<typeof validateSiteLogoMasterContent>>,
  presentation: SiteLogoPresentation
) {
  const canvasLayout = resolveSiteLogoCanvasLayout(source.width, source.height, presentation.canvasEdges);
  assertSiteLogoRasterBudget(source.width, source.height, canvasLayout);
  const workspace = assertSiteLogoEffectWorkspaceBudget(canvasLayout, presentation);
  const decoded = await sharp(source.bytes, { limitInputPixels: SITE_LOGO_MAX_SOURCE_PIXELS })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== source.width || decoded.info.height !== source.height || decoded.info.channels !== 4) {
    throw new Error('Uploaded site logo dimensions changed during decoding.');
  }
  const sourceAlpha = Buffer.alloc(source.width * source.height);
  for (let index = 0; index < sourceAlpha.length; index += 1) {
    sourceAlpha[index] = decoded.data[index * 4 + 3];
  }
  const workspaceAlpha = placeAlphaMask(
    sourceAlpha,
    source.width,
    source.height,
    workspace.width,
    workspace.height,
    canvasLayout.sourceLeft + workspace.padding,
    canvasLayout.sourceTop + workspace.padding
  );
  const placedSource = placeRgba(
    decoded.data,
    source.width,
    source.height,
    canvasLayout.width,
    canvasLayout.height,
    canvasLayout.sourceLeft,
    canvasLayout.sourceTop
  );
  const raw = { width: canvasLayout.width, height: canvasLayout.height, channels: 4 as const };
  const transparent = resolveSiteLogoTransparentColors(presentation.transparentColors);
  const background = solidBackground(
    canvasLayout.width,
    canvasLayout.height,
    transparent.background ? null : color(presentation.backgroundColor),
    transparent.background ? null : color(presentation.backgroundColor),
    canvasLayout.height
  );
  const workspaceEffectLayers = await effectLayers(
    workspaceAlpha,
    workspace.width,
    workspace.height,
    presentation
  );
  const layers = workspaceEffectLayers.map((layer) => ({
    input: placeRgba(
      layer.input,
      workspace.width,
      workspace.height,
      canvasLayout.width,
      canvasLayout.height,
      -workspace.padding,
      -workspace.padding
    ),
    raw
  }));
  layers.push({ input: placedSource, raw });
  return {
    bytes: await sharp(background, { raw }).composite(layers).png({ compressionLevel: 9 }).toBuffer(),
    width: canvasLayout.width,
    height: canvasLayout.height
  };
}

export async function resolveSiteLogoArtwork(
  config: SiteLogoConfig,
  purposeId: SiteLogoPurposeId
): Promise<ResolvedSiteLogoArtwork | null> {
  const placement = config.placements[purposeId];
  if (!placement?.enabled) return null;
  const master = resolveSiteLogoMaster(config, purposeId);
  if (!master) return null;
  const presentation = resolveSiteLogoPresentation(placement);
  if (isBuiltInAtehnaLogoMaster(master)) {
    const canvasLayout = resolveSiteLogoCanvasLayout(
      SITE_LOGO_BUILTIN_ORIGINAL_MASTER.intrinsicWidth,
      SITE_LOGO_BUILTIN_ORIGINAL_MASTER.intrinsicHeight,
      presentation.canvasEdges
    );
    assertSiteLogoRasterBudget(
      SITE_LOGO_BUILTIN_ORIGINAL_MASTER.intrinsicWidth,
      SITE_LOGO_BUILTIN_ORIGINAL_MASTER.intrinsicHeight,
      canvasLayout
    );
    return {
      bytes: await renderBuiltInAtehnaLogoArtwork(presentation),
      format: 'png',
      intrinsicWidth: canvasLayout.width,
      intrinsicHeight: canvasLayout.height,
      master,
      presentation
    };
  }
  const uploaded = await renderUploadedArtwork(await validateSiteLogoMasterContent(master), presentation);
  return {
    bytes: uploaded.bytes,
    format: 'png',
    intrinsicWidth: uploaded.width,
    intrinsicHeight: uploaded.height,
    master: { ...master, intrinsicWidth: uploaded.width, intrinsicHeight: uploaded.height },
    presentation
  };
}
