export const PDFME_V2_SVG_LIMITS = Object.freeze({
  MAX_BYTES: 262_144,
  MAX_ELEMENTS: 2_000,
  MAX_ATTRIBUTES: 10_000,
  MAX_ATTRIBUTE_LENGTH: 8_192
});

const ALLOWED_SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'stop',
  'pattern',
  'use',
  'title',
  'desc'
]);

const URL_PROTOCOL_PATTERN = /(?:https?|ftp|file|blob|data|javascript|vbscript):/iu;
const NETWORK_PATH_PATTERN = /^\s*\/\//u;
const DANGEROUS_STYLE_PATTERN = /(?:@import|expression\s*\(|behavior\s*:|-moz-binding)/iu;

export class PdfmeV2SvgValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PdfmeV2SvgValidationError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new PdfmeV2SvgValidationError(code, message);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validateReferences(attributeName: string, value: string): void {
  const normalizedName = attributeName.toLocaleLowerCase('en-US');
  const normalizedValue = value.trim();

  if (normalizedName === 'xmlns') {
    if (normalizedValue !== 'http://www.w3.org/2000/svg') {
      fail('SVG_EXTERNAL_REFERENCE', 'SVG xmlns must use the SVG namespace.');
    }
    return;
  }
  if (normalizedName === 'xmlns:xlink') {
    if (normalizedValue !== 'http://www.w3.org/1999/xlink') {
      fail('SVG_EXTERNAL_REFERENCE', 'SVG xlink namespace is not allowed.');
    }
    return;
  }

  if (URL_PROTOCOL_PATTERN.test(normalizedValue) || NETWORK_PATH_PATTERN.test(normalizedValue)) {
    fail('SVG_EXTERNAL_REFERENCE', 'SVG external, file, Blob, data and script URLs are forbidden.');
  }
  if (/base64\s*,/iu.test(normalizedValue)) {
    fail('SVG_DATA_REFERENCE', 'Inline base64 SVG references are forbidden.');
  }

  if (normalizedName === 'href' || normalizedName === 'xlink:href') {
    if (!/^#[A-Za-z_][\w:.-]*$/u.test(normalizedValue)) {
      fail('SVG_EXTERNAL_REFERENCE', 'SVG href values must be local fragment references.');
    }
  }
  if (normalizedName === 'src' && normalizedValue) {
    fail('SVG_EXTERNAL_REFERENCE', 'SVG src references are forbidden.');
  }

  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/giu;
  for (const match of normalizedValue.matchAll(urlPattern)) {
    if (!/^#[A-Za-z_][\w:.-]*$/u.test(match[2])) {
      fail('SVG_EXTERNAL_REFERENCE', 'SVG url() values must be local fragment references.');
    }
  }
  if (/url\s*\(/iu.test(normalizedValue)) {
    const withoutSafeUrls = normalizedValue.replace(urlPattern, '');
    if (/url\s*\(/iu.test(withoutSafeUrls)) {
      fail('SVG_MALFORMED', 'SVG contains a malformed url() reference.');
    }
  }

  if (normalizedName === 'style' && DANGEROUS_STYLE_PATTERN.test(normalizedValue)) {
    fail('SVG_DANGEROUS_STYLE', 'SVG style contains an unsafe construct.');
  }
}

function parseAttributes(rawAttributes: string): number {
  let remaining = rawAttributes;
  let count = 0;
  const names = new Set<string>();
  const attributePattern = /^\s+([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/u;

  while (remaining.length > 0) {
    if (/^\s*$/u.test(remaining)) break;
    const match = remaining.match(attributePattern);
    if (!match) fail('SVG_MALFORMED', 'SVG contains a malformed or unquoted attribute.');
    const name = match[1].toLocaleLowerCase('en-US');
    const value = match[2] ?? match[3] ?? '';
    if (names.has(name)) fail('SVG_MALFORMED', `SVG attribute ${name} is duplicated.`);
    names.add(name);
    if (name.startsWith('on')) {
      fail('SVG_EVENT_HANDLER', 'SVG event-handler attributes are forbidden.');
    }
    if (value.length > PDFME_V2_SVG_LIMITS.MAX_ATTRIBUTE_LENGTH) {
      fail('SVG_ATTRIBUTE_TOO_LONG', 'SVG attribute exceeds the configured limit.');
    }
    validateReferences(name, value);
    count += 1;
    remaining = remaining.slice(match[0].length);
  }
  return count;
}

function validateEntities(source: string): void {
  if (/&#(?:\d+|x[\dA-Fa-f]+);/u.test(source)) {
    fail(
      'SVG_NUMERIC_ENTITY',
      'SVG numeric entities are forbidden; use literal Unicode text instead.'
    );
  }
  const withoutAllowedEntities = source.replace(
    /&(?:amp|lt|gt|quot|apos);/gu,
    ''
  );
  if (withoutAllowedEntities.includes('&')) {
    fail('SVG_MALFORMED', 'SVG contains a malformed or custom entity.');
  }
}

/**
 * Strict server-safe SVG sanitizer. Safe SVG is returned without comments;
 * dangerous or malformed input is rejected instead of silently repaired.
 */
export function sanitizePdfmeV2Svg(value: unknown): string {
  if (typeof value !== 'string') fail('SVG_TYPE', 'SVG must be a string.');
  let source = value.replace(/^\uFEFF/u, '').trim();
  if (!source) fail('SVG_EMPTY', 'SVG must not be empty.');
  if (utf8ByteLength(source) > PDFME_V2_SVG_LIMITS.MAX_BYTES) {
    fail('SVG_TOO_LARGE', 'SVG exceeds the configured byte limit.');
  }
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?(?!xml\s)/iu.test(source)) {
    fail('SVG_DECLARATION', 'SVG declarations, entities and CDATA are forbidden.');
  }

  source = source.replace(/^<\?xml\s+[^?]*\?>\s*/iu, '');
  source = source.replace(/<!--[\s\S]*?-->/gu, '');
  if (/<!--|-->|<\?/u.test(source)) {
    fail('SVG_MALFORMED', 'SVG contains a malformed comment or declaration.');
  }
  validateEntities(source);

  const stack: string[] = [];
  const tokenPattern = /<[^>]+>|[^<]+/gu;
  let cursor = 0;
  let elementCount = 0;
  let attributeCount = 0;
  let rootClosed = false;

  for (const match of source.matchAll(tokenPattern)) {
    if (match.index !== cursor) fail('SVG_MALFORMED', 'SVG tokenization failed.');
    const token = match[0];
    cursor += token.length;

    if (!token.startsWith('<')) {
      if (stack.length === 0 && token.trim()) {
        fail('SVG_MALFORMED', 'SVG contains text outside its root element.');
      }
      continue;
    }

    const tag = token.match(/^<\s*(\/?)\s*([A-Za-z][\w:.-]*)([\s\S]*?)(\/?)\s*>$/u);
    if (!tag) fail('SVG_MALFORMED', 'SVG contains a malformed tag.');
    const closing = tag[1] === '/';
    const name = tag[2].toLocaleLowerCase('en-US');
    const rawAttributes = tag[3];
    const selfClosing = tag[4] === '/';

    if (!ALLOWED_SVG_TAGS.has(name)) {
      fail('SVG_UNKNOWN_ELEMENT', `SVG element <${tag[2]}> is not allowed.`);
    }
    if (closing) {
      if (selfClosing || rawAttributes.trim()) {
        fail('SVG_MALFORMED', 'SVG closing tags cannot contain attributes.');
      }
      if (stack.pop() !== name) fail('SVG_MALFORMED', 'SVG tags are not properly nested.');
      if (stack.length === 0) rootClosed = true;
      continue;
    }

    if (rootClosed) fail('SVG_MALFORMED', 'SVG may contain only one root element.');
    if (stack.length === 0 && name !== 'svg') {
      fail('SVG_ROOT', 'SVG root element must be <svg>.');
    }
    elementCount += 1;
    if (elementCount > PDFME_V2_SVG_LIMITS.MAX_ELEMENTS) {
      fail('SVG_TOO_COMPLEX', 'SVG contains too many elements.');
    }
    attributeCount += parseAttributes(rawAttributes);
    if (attributeCount > PDFME_V2_SVG_LIMITS.MAX_ATTRIBUTES) {
      fail('SVG_TOO_COMPLEX', 'SVG contains too many attributes.');
    }
    if (!selfClosing) stack.push(name);
    else if (stack.length === 0) rootClosed = true;
  }

  if (cursor !== source.length || stack.length !== 0 || !rootClosed || elementCount === 0) {
    fail('SVG_MALFORMED', 'SVG document is incomplete or malformed.');
  }
  return source.trim();
}

export const validatePdfmeV2Svg = sanitizePdfmeV2Svg;
