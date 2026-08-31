import { checkTemplate } from '@pdfme/common';

import {
  isPdfmeV2AllowedBinding,
  type PdfmeV2BindingName
} from './bindings';
import { isPdfmeV2DocumentType } from './documentTypes';
import type { DocumentRenderData } from './renderData';
import { sanitizePdfmeV2Svg, PDFME_V2_SVG_LIMITS } from './svg';
import {
  PDFME_V2_A4_HEIGHT_MM,
  PDFME_V2_A4_WIDTH_MM,
  PDFME_V2_ENGINE_VERSION,
  PDFME_V2_SCHEMA_TYPES,
  PDFME_V2_SCHEMA_VERSION,
  PDFME_V2_VISIBILITY_CONDITIONS,
  type AtehnaPdfmeSchema,
  type PdfmeV2CanonicalTemplate,
  type PdfmeV2SchemaType
} from './template';

export const PDFME_V2_LIMITS = Object.freeze({
  MAX_TEMPLATE_JSON_BYTES: 1_048_576,
  MAX_RENDER_DATA_JSON_BYTES: 2_097_152,
  MAX_GENERATED_PDF_BYTES: 20_000_000,
  MAX_AUTHORED_PAGES: 1,
  MAX_SCHEMAS_PER_PAGE: 250,
  MAX_TOTAL_SCHEMAS: 250,
  MAX_SCHEMA_NAME_LENGTH: 128,
  MAX_SCHEMA_STRING_LENGTH: 16_384,
  MAX_LABEL_LENGTH: 256,
  MAX_ASSET_REVISION_ID_LENGTH: 128,
  MAX_REVISION_ID_LENGTH: 128,
  MAX_JSON_DEPTH: 24,
  MAX_JSON_KEYS: 20_000,
  MAX_ARRAY_LENGTH: 10_000,
  MAX_RENDER_ITEMS: 100,
  MAX_NOTES_LENGTH: 4_000,
  MAX_ITEM_SKU_LENGTH: 512,
  MAX_ITEM_NAME_LENGTH: 2_048,
  MAX_TEXT_FIELD_LENGTH: 4_096,
  MAX_QUANTITY: 1_000_000,
  MAX_AMOUNT: 1_000_000_000_000,
  MIN_GEOMETRY_MM: 0.01,
  MAX_ROTATION_DEGREES: 360,
  MIN_FONT_SIZE: 1,
  MAX_FONT_SIZE: 200,
  MAX_SVG_BYTES: PDFME_V2_SVG_LIMITS.MAX_BYTES
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const EXTERNAL_URL_PATTERN = /(?:https?|ftp|file|blob|data|javascript|vbscript):/iu;
const NETWORK_PATH_PATTERN = /^\s*\/\//u;
const BASE64_PATTERN = /base64\s*,/iu;

const BASE_SCHEMA_KEYS = [
  'atehnaId',
  'name',
  'type',
  'content',
  'position',
  'width',
  'height',
  'rotate',
  'opacity',
  'readOnly',
  'required'
] as const;
const TEXT_SCHEMA_KEYS = [
  'fontName',
  'textFormat',
  'fontVariants',
  'fontVariantFallback',
  'alignment',
  'verticalAlignment',
  'fontSize',
  'lineHeight',
  'strikethrough',
  'underline',
  'characterSpacing',
  'dynamicFontSize',
  'overflow',
  'fontColor',
  'backgroundColor',
  'borderColor',
  'borderWidth',
  'padding'
] as const;
const TABLE_SCHEMA_KEYS = [
  'showHead',
  'repeatHead',
  'head',
  'headWidthPercentages',
  'tableStyles',
  'headStyles',
  'bodyStyles',
  'columnStyles'
] as const;

export class PdfmeV2ValidationError extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PdfmeV2ValidationError';
    this.code = code;
    this.path = path;
  }
}

function fail(code: string, path: string, message: string): never {
  throw new PdfmeV2ValidationError(code, path, message);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function recordValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('EXPECTED_OBJECT', path, 'must be an object.');
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail('UNKNOWN_PROPERTY', `${path}.${key}`, 'is not allowed.');
  }
}

function inspectJsonData(
  value: unknown,
  path: string,
  state: { keys: number; seen: WeakSet<object> },
  depth = 0
): void {
  if (depth > PDFME_V2_LIMITS.MAX_JSON_DEPTH) {
    fail('JSON_TOO_DEEP', path, 'exceeds the configured JSON depth.');
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_FINITE_NUMBER', path, 'must be finite.');
    return;
  }
  if (typeof value !== 'object') fail('NON_JSON_VALUE', path, 'must contain JSON data only.');
  if (state.seen.has(value)) fail('CYCLIC_JSON', path, 'must not contain cycles.');
  state.seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > PDFME_V2_LIMITS.MAX_ARRAY_LENGTH) {
      fail('ARRAY_TOO_LARGE', path, 'exceeds the configured array length.');
    }
    value.forEach((entry, index) =>
      inspectJsonData(entry, `${path}[${index}]`, state, depth + 1));
    state.seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('NON_PLAIN_OBJECT', path, 'must use a plain object.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    state.keys += 1;
    if (state.keys > PDFME_V2_LIMITS.MAX_JSON_KEYS) {
      fail('JSON_TOO_COMPLEX', path, 'contains too many keys.');
    }
    if (DANGEROUS_KEYS.has(key)) {
      fail('PROTOTYPE_PATH', `${path}.${key}`, 'prototype-related keys are forbidden.');
    }
    if ('get' in descriptor || 'set' in descriptor) {
      fail('JSON_ACCESSOR', `${path}.${key}`, 'accessor properties are forbidden.');
    }
    inspectJsonData(descriptor.value, `${path}.${key}`, state, depth + 1);
  }
  state.seen.delete(value);
}

function parseAndBoundJson(value: unknown, path: string, maxBytes: number): unknown {
  let candidate = value;
  if (typeof value === 'string') {
    if (utf8ByteLength(value) > maxBytes) fail('JSON_TOO_LARGE', path, 'exceeds the byte limit.');
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      fail('MALFORMED_JSON', path, 'is not valid JSON.');
    }
  }
  inspectJsonData(candidate, path, { keys: 0, seen: new WeakSet() });
  const serialized = JSON.stringify(candidate);
  if (utf8ByteLength(serialized) > maxBytes) {
    fail('JSON_TOO_LARGE', path, 'exceeds the byte limit.');
  }
  return candidate;
}

function stringValue(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string') fail('EXPECTED_STRING', path, 'must be a string.');
  if (value.length > maxLength) fail('STRING_TOO_LONG', path, 'exceeds the configured length.');
  return value;
}

function safeString(value: unknown, path: string, maxLength: number): string {
  const result = stringValue(value, path, maxLength);
  if (
    EXTERNAL_URL_PATTERN.test(result)
    || NETWORK_PATH_PATTERN.test(result)
    || BASE64_PATTERN.test(result)
  ) {
    fail('UNSAFE_URL', path, 'external, file, Blob, data and base64 values are forbidden.');
  }
  return result;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail('NON_FINITE_NUMBER', path, 'must be a finite number.');
  }
  return value;
}

function boundedNumber(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number {
  const result = finiteNumber(value, path);
  if (result < minimum || result > maximum) {
    fail('NUMBER_OUT_OF_RANGE', path, `must be between ${minimum} and ${maximum}.`);
  }
  return result;
}

export function assertAllowedPdfmeV2Binding(
  value: unknown,
  path = 'binding'
): PdfmeV2BindingName {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    fail('INVALID_BINDING', path, 'must be a simple flat identifier.');
  }
  if (DANGEROUS_KEYS.has(value) || !isPdfmeV2AllowedBinding(value)) {
    fail('INVALID_BINDING', path, 'is not in the v2 binding allowlist.');
  }
  return value;
}

function collectPlaceholders(value: string, path: string): PdfmeV2BindingName[] {
  if (/\$\{|\{\{|\}\}/u.test(value)) {
    fail('UNSAFE_EXPRESSION', path, 'contains unsupported expression syntax.');
  }
  const bindings: PdfmeV2BindingName[] = [];
  let remainder = value;
  const placeholderPattern = /\{([^{}]+)\}/gu;
  for (const match of value.matchAll(placeholderPattern)) {
    bindings.push(assertAllowedPdfmeV2Binding(match[1].trim(), path));
    remainder = remainder.replace(match[0], '');
  }
  if (/[{}]/u.test(remainder)) {
    fail('UNSAFE_EXPRESSION', path, 'contains malformed or nested braces.');
  }
  return bindings;
}

function allowedSchemaKeys(type: PdfmeV2SchemaType): readonly string[] {
  if (type === 'text') return [...BASE_SCHEMA_KEYS, ...TEXT_SCHEMA_KEYS];
  if (type === 'multiVariableText') {
    return [...BASE_SCHEMA_KEYS, ...TEXT_SCHEMA_KEYS, 'text', 'variables'];
  }
  if (type === 'table') return [...BASE_SCHEMA_KEYS, ...TABLE_SCHEMA_KEYS];
  if (type === 'list') {
    return [
      ...BASE_SCHEMA_KEYS,
      ...TEXT_SCHEMA_KEYS,
      'listStyle',
      'markerWidth',
      'markerGap',
      'indentSize',
      'itemSpacing'
    ];
  }
  if (type === 'line') return [...BASE_SCHEMA_KEYS, 'color'];
  if (type === 'rectangle' || type === 'ellipse') {
    return [...BASE_SCHEMA_KEYS, 'borderWidth', 'borderColor', 'color', 'radius'];
  }
  return BASE_SCHEMA_KEYS;
}

function inspectPersistedStrings(
  value: unknown,
  path: string,
  options: { skipSvgContent?: boolean } = {}
): void {
  if (typeof value === 'string') {
    safeString(value, path, PDFME_V2_LIMITS.MAX_SCHEMA_STRING_LENGTH);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectPersistedStrings(entry, `${path}[${index}]`, options));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (options.skipSvgContent && key === 'content') continue;
    inspectPersistedStrings(entry, `${path}.${key}`, options);
  }
}

function assertSchemaInsidePage(
  schema: Record<string, unknown>,
  path: string
): void {
  const position = recordValue(schema.position, `${path}.position`);
  assertKnownKeys(position, ['x', 'y'], `${path}.position`);
  const x = finiteNumber(position.x, `${path}.position.x`);
  const y = finiteNumber(position.y, `${path}.position.y`);
  const width = boundedNumber(
    schema.width,
    `${path}.width`,
    PDFME_V2_LIMITS.MIN_GEOMETRY_MM,
    PDFME_V2_A4_WIDTH_MM
  );
  const height = boundedNumber(
    schema.height,
    `${path}.height`,
    PDFME_V2_LIMITS.MIN_GEOMETRY_MM,
    PDFME_V2_A4_HEIGHT_MM
  );
  const rotation = boundedNumber(
    schema.rotate ?? 0,
    `${path}.rotate`,
    -PDFME_V2_LIMITS.MAX_ROTATION_DEGREES,
    PDFME_V2_LIMITS.MAX_ROTATION_DEGREES
  );
  boundedNumber(schema.opacity ?? 1, `${path}.opacity`, 0, 1);

  const radians = rotation * Math.PI / 180;
  const halfWidth = (
    Math.abs(Math.cos(radians)) * width
    + Math.abs(Math.sin(radians)) * height
  ) / 2;
  const halfHeight = (
    Math.abs(Math.sin(radians)) * width
    + Math.abs(Math.cos(radians)) * height
  ) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const epsilon = 0.000_001;
  if (
    centerX - halfWidth < -epsilon
    || centerY - halfHeight < -epsilon
    || centerX + halfWidth > PDFME_V2_A4_WIDTH_MM + epsilon
    || centerY + halfHeight > PDFME_V2_A4_HEIGHT_MM + epsilon
  ) {
    fail('GEOMETRY_OUTSIDE_PAGE', path, 'extends outside the A4 media box.');
  }
}

function assertTextSchema(schema: Record<string, unknown>, path: string): void {
  if (schema.fontSize !== undefined) {
    boundedNumber(
      schema.fontSize,
      `${path}.fontSize`,
      PDFME_V2_LIMITS.MIN_FONT_SIZE,
      PDFME_V2_LIMITS.MAX_FONT_SIZE
    );
  }
  if (schema.lineHeight !== undefined) boundedNumber(schema.lineHeight, `${path}.lineHeight`, 0.1, 10);
  if (schema.characterSpacing !== undefined) {
    boundedNumber(schema.characterSpacing, `${path}.characterSpacing`, -100, 1_000);
  }
  if (schema.overflow !== undefined && schema.overflow !== 'visible' && schema.overflow !== 'expand') {
    fail('INVALID_TEXT_OVERFLOW', `${path}.overflow`, 'must be visible or expand.');
  }
}

function assertTableSchema(schema: Record<string, unknown>, path: string): void {
  if (schema.showHead !== true || schema.repeatHead !== true) {
    fail('TABLE_HEADER_REQUIRED', path, 'must show and repeat its header.');
  }
  if (!Array.isArray(schema.head) || !Array.isArray(schema.headWidthPercentages)) {
    fail('INVALID_TABLE', path, 'must define table headers and widths.');
  }
  if (schema.head.length === 0 || schema.head.length !== schema.headWidthPercentages.length) {
    fail('INVALID_TABLE', path, 'header and width counts must match.');
  }
  schema.head.forEach((entry, index) =>
    safeString(entry, `${path}.head[${index}]`, PDFME_V2_LIMITS.MAX_LABEL_LENGTH));
  const totalWidth = schema.headWidthPercentages.reduce<number>((sum, value, index) =>
    sum + boundedNumber(value, `${path}.headWidthPercentages[${index}]`, 0.01, 100), 0);
  if (Math.abs(totalWidth - 100) > 0.01) {
    fail('INVALID_TABLE_WIDTHS', `${path}.headWidthPercentages`, 'must add up to 100.');
  }
  const content = stringValue(
    schema.content ?? '',
    `${path}.content`,
    PDFME_V2_LIMITS.MAX_SCHEMA_STRING_LENGTH
  );
  try {
    const rows = JSON.parse(content || '[]') as unknown;
    if (!Array.isArray(rows) || rows.length !== 0) {
      fail('PERSISTED_TABLE_ROWS', `${path}.content`, 'must not persist generated item rows.');
    }
  } catch (error) {
    if (error instanceof PdfmeV2ValidationError) throw error;
    fail('INVALID_TABLE_CONTENT', `${path}.content`, 'must be an empty JSON array.');
  }
}

function schemaBindings(
  schema: Record<string, unknown>,
  path: string
): PdfmeV2BindingName[] {
  const result: PdfmeV2BindingName[] = [];
  const type = schema.type;
  const readOnly = schema.readOnly === true;

  if (type === 'text') {
    const content = stringValue(
      schema.content ?? '',
      `${path}.content`,
      PDFME_V2_LIMITS.MAX_SCHEMA_STRING_LENGTH
    );
    if (readOnly) result.push(...collectPlaceholders(content, `${path}.content`));
  } else if (type === 'multiVariableText') {
    const text = stringValue(
      schema.text ?? '',
      `${path}.text`,
      PDFME_V2_LIMITS.MAX_SCHEMA_STRING_LENGTH
    );
    result.push(...collectPlaceholders(text, `${path}.text`));
    if (schema.content !== undefined && schema.content !== '' && schema.content !== '{}') {
      fail('PERSISTED_SAMPLE_DATA', `${path}.content`, 'must not persist variable sample data.');
    }
    if (!Array.isArray(schema.variables)) {
      fail('INVALID_BINDING', `${path}.variables`, 'must be an array.');
    }
    schema.variables.forEach((binding, index) =>
      result.push(assertAllowedPdfmeV2Binding(binding, `${path}.variables[${index}]`)));
  } else if (type === 'svg') {
    const content = stringValue(
      schema.content ?? '',
      `${path}.content`,
      PDFME_V2_SVG_LIMITS.MAX_BYTES
    );
    if (content) {
      try {
        sanitizePdfmeV2Svg(content);
      } catch (error) {
        fail(
          'UNSAFE_SVG',
          `${path}.content`,
          error instanceof Error ? error.message : 'is unsafe.'
        );
      }
    }
  } else if (type === 'image') {
    if (schema.content !== undefined && schema.content !== '') {
      fail('PERSISTED_ASSET_BYTES', `${path}.content`, 'image bytes and URLs must be hydrated ephemerally.');
    }
  }

  if (!readOnly && type !== 'line' && type !== 'rectangle' && type !== 'ellipse') {
    result.push(assertAllowedPdfmeV2Binding(schema.name, `${path}.name`));
  }
  return [...new Set(result)];
}

function validateSchema(
  value: unknown,
  path: string
): { schema: AtehnaPdfmeSchema; bindings: readonly PdfmeV2BindingName[] } {
  const schema = recordValue(value, path);
  if (
    typeof schema.type !== 'string'
    || !(PDFME_V2_SCHEMA_TYPES as readonly string[]).includes(schema.type)
  ) {
    fail('UNKNOWN_SCHEMA_TYPE', `${path}.type`, 'is not in the official plugin allowlist.');
  }
  const type = schema.type as PdfmeV2SchemaType;
  assertKnownKeys(schema, allowedSchemaKeys(type), path);
  if ('id' in schema || '__splitRange' in schema || '__isSplit' in schema) {
    fail('TRANSIENT_SCHEMA_PROPERTY', path, 'contains a transient pdfme property.');
  }
  const atehnaId = stringValue(schema.atehnaId, `${path}.atehnaId`, 64);
  if (!UUID_PATTERN.test(atehnaId)) {
    fail('INVALID_ATEHNA_ID', `${path}.atehnaId`, 'must be an RFC 4122 UUID.');
  }
  const name = stringValue(
    schema.name,
    `${path}.name`,
    PDFME_V2_LIMITS.MAX_SCHEMA_NAME_LENGTH
  );
  if (!IDENTIFIER_PATTERN.test(name) || DANGEROUS_KEYS.has(name)) {
    fail('INVALID_SCHEMA_NAME', `${path}.name`, 'must be a safe flat identifier.');
  }
  if (schema.readOnly !== undefined && typeof schema.readOnly !== 'boolean') {
    fail('INVALID_BOOLEAN', `${path}.readOnly`, 'must be boolean.');
  }
  if (schema.required !== undefined && typeof schema.required !== 'boolean') {
    fail('INVALID_BOOLEAN', `${path}.required`, 'must be boolean.');
  }
  assertSchemaInsidePage(schema, path);
  if (type === 'text' || type === 'multiVariableText' || type === 'list') {
    assertTextSchema(schema, path);
  }
  if (type === 'table') assertTableSchema(schema, path);
  inspectPersistedStrings(schema, path, { skipSvgContent: type === 'svg' || type === 'image' });
  return {
    schema: schema as AtehnaPdfmeSchema,
    bindings: schemaBindings(schema, path)
  };
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return rightSet.size === right.length && left.every((entry) => rightSet.has(entry));
}

function validateEnvelopeMapKeys(
  value: Record<string, unknown>,
  schemaIds: ReadonlySet<string>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!schemaIds.has(key)) fail('UNKNOWN_ATEHNA_ID', `${path}.${key}`, 'does not reference a schema.');
  }
}

export function validatePdfmeV2CanonicalTemplate(
  value: unknown
): PdfmeV2CanonicalTemplate {
  const candidate = parseAndBoundJson(
    value,
    'canonical',
    PDFME_V2_LIMITS.MAX_TEMPLATE_JSON_BYTES
  );
  const root = recordValue(candidate, 'canonical');
  assertKnownKeys(root, ['template', 'envelope'], 'canonical');
  const template = recordValue(root.template, 'canonical.template');
  assertKnownKeys(template, ['basePdf', 'schemas', 'pdfmeVersion'], 'canonical.template');
  if (template.pdfmeVersion !== PDFME_V2_ENGINE_VERSION) {
    fail('ENGINE_VERSION_MISMATCH', 'canonical.template.pdfmeVersion', `must be ${PDFME_V2_ENGINE_VERSION}.`);
  }

  const basePdf = recordValue(template.basePdf, 'canonical.template.basePdf');
  assertKnownKeys(basePdf, ['width', 'height', 'padding', 'staticSchema'], 'canonical.template.basePdf');
  if (
    basePdf.width !== PDFME_V2_A4_WIDTH_MM
    || basePdf.height !== PDFME_V2_A4_HEIGHT_MM
  ) {
    fail('INVALID_PAGE_SIZE', 'canonical.template.basePdf', 'must be a blank 210 × 297 mm A4 object.');
  }
  if (!Array.isArray(basePdf.padding) || basePdf.padding.length !== 4) {
    fail('INVALID_PAGE_PADDING', 'canonical.template.basePdf.padding', 'must contain four millimetre values.');
  }
  const padding = basePdf.padding.map((entry, index) =>
    boundedNumber(entry, `canonical.template.basePdf.padding[${index}]`, 0, 100));
  if (
    padding[0] + padding[2] >= PDFME_V2_A4_HEIGHT_MM
    || padding[1] + padding[3] >= PDFME_V2_A4_WIDTH_MM
  ) {
    fail('INVALID_PAGE_PADDING', 'canonical.template.basePdf.padding', 'leaves no drawable page area.');
  }
  if (
    basePdf.staticSchema !== undefined
    && (!Array.isArray(basePdf.staticSchema) || basePdf.staticSchema.length !== 0)
  ) {
    fail(
      'PERSISTED_STATIC_SCHEMA',
      'canonical.template.basePdf.staticSchema',
      'must be empty; headers and footers are authored as ordinary schemas.'
    );
  }

  if (!Array.isArray(template.schemas)) {
    fail('INVALID_SCHEMAS', 'canonical.template.schemas', 'must be an array of pages.');
  }
  if (
    template.schemas.length !== PDFME_V2_LIMITS.MAX_AUTHORED_PAGES
  ) {
    fail('INVALID_PAGE_COUNT', 'canonical.template.schemas', 'must contain exactly one authored page.');
  }

  const schemaIds = new Set<string>();
  const schemaNames = new Set<string>();
  const observedBindings = new Map<string, readonly PdfmeV2BindingName[]>();
  let totalSchemas = 0;
  template.schemas.forEach((page, pageIndex) => {
    if (!Array.isArray(page)) fail('INVALID_SCHEMAS', `canonical.template.schemas[${pageIndex}]`, 'must be an array.');
    if (page.length > PDFME_V2_LIMITS.MAX_SCHEMAS_PER_PAGE) {
      fail('TOO_MANY_SCHEMAS', `canonical.template.schemas[${pageIndex}]`, 'contains too many schemas.');
    }
    totalSchemas += page.length;
    page.forEach((schemaValue, schemaIndex) => {
      const path = `canonical.template.schemas[${pageIndex}][${schemaIndex}]`;
      const { schema, bindings } = validateSchema(schemaValue, path);
      if (schemaIds.has(schema.atehnaId)) {
        fail('DUPLICATE_ATEHNA_ID', `${path}.atehnaId`, 'must be unique in the template.');
      }
      if (schemaNames.has(schema.name)) {
        fail('DUPLICATE_SCHEMA_NAME', `${path}.name`, 'must be unique in the template.');
      }
      schemaIds.add(schema.atehnaId);
      schemaNames.add(schema.name);
      observedBindings.set(schema.atehnaId, bindings);
    });
  });
  if (totalSchemas > PDFME_V2_LIMITS.MAX_TOTAL_SCHEMAS) {
    fail('TOO_MANY_SCHEMAS', 'canonical.template.schemas', 'contains too many schemas.');
  }

  const envelope = recordValue(root.envelope, 'canonical.envelope');
  assertKnownKeys(
    envelope,
    [
      'schemaVersion',
      'pdfmeVersion',
      'documentType',
      'labels',
      'bindings',
      'visibilityConditions',
      'repeating',
      'assetRevisionIds',
      'revision'
    ],
    'canonical.envelope'
  );
  if (envelope.schemaVersion !== PDFME_V2_SCHEMA_VERSION) {
    fail('SCHEMA_VERSION_MISMATCH', 'canonical.envelope.schemaVersion', `must be ${PDFME_V2_SCHEMA_VERSION}.`);
  }
  if (envelope.pdfmeVersion !== PDFME_V2_ENGINE_VERSION) {
    fail('ENGINE_VERSION_MISMATCH', 'canonical.envelope.pdfmeVersion', `must be ${PDFME_V2_ENGINE_VERSION}.`);
  }
  if (!isPdfmeV2DocumentType(envelope.documentType)) {
    fail('INVALID_DOCUMENT_TYPE', 'canonical.envelope.documentType', 'is not a generated v2 document type.');
  }

  const labels = recordValue(envelope.labels, 'canonical.envelope.labels');
  validateEnvelopeMapKeys(labels, schemaIds, 'canonical.envelope.labels');
  for (const [id, label] of Object.entries(labels)) {
    safeString(label, `canonical.envelope.labels.${id}`, PDFME_V2_LIMITS.MAX_LABEL_LENGTH);
  }

  const bindings = recordValue(envelope.bindings, 'canonical.envelope.bindings');
  validateEnvelopeMapKeys(bindings, schemaIds, 'canonical.envelope.bindings');
  for (const id of schemaIds) {
    const declaredValue = bindings[id];
    const declared = declaredValue === undefined ? [] : declaredValue;
    if (!Array.isArray(declared)) {
      fail('INVALID_BINDING', `canonical.envelope.bindings.${id}`, 'must be an array.');
    }
    const validated = declared.map((entry, index) =>
      assertAllowedPdfmeV2Binding(entry, `canonical.envelope.bindings.${id}[${index}]`));
    if (new Set(validated).size !== validated.length) {
      fail('DUPLICATE_BINDING', `canonical.envelope.bindings.${id}`, 'contains duplicate bindings.');
    }
    if (!sameStringSet(validated, observedBindings.get(id) ?? [])) {
      fail('BINDING_METADATA_MISMATCH', `canonical.envelope.bindings.${id}`, 'must exactly describe schema bindings.');
    }
  }

  const visibility = recordValue(
    envelope.visibilityConditions,
    'canonical.envelope.visibilityConditions'
  );
  validateEnvelopeMapKeys(visibility, schemaIds, 'canonical.envelope.visibilityConditions');
  for (const [id, condition] of Object.entries(visibility)) {
    if (
      typeof condition !== 'string'
      || !(PDFME_V2_VISIBILITY_CONDITIONS as readonly string[]).includes(condition)
    ) {
      fail('INVALID_VISIBILITY_CONDITION', `canonical.envelope.visibilityConditions.${id}`, 'is not allowlisted.');
    }
  }

  const repeating = recordValue(envelope.repeating, 'canonical.envelope.repeating');
  assertKnownKeys(repeating, ['header', 'footer'], 'canonical.envelope.repeating');
  const repeatedIds = new Set<string>();
  for (const role of ['header', 'footer'] as const) {
    const ids = repeating[role];
    if (!Array.isArray(ids) || ids.length === 0) {
      fail('MISSING_REPEAT_MARKER', `canonical.envelope.repeating.${role}`, 'must mark at least one authored schema.');
    }
    ids.forEach((id, index) => {
      const markerPath = `canonical.envelope.repeating.${role}[${index}]`;
      const stableId = stringValue(id, markerPath, 64);
      if (!schemaIds.has(stableId)) fail('UNKNOWN_ATEHNA_ID', markerPath, 'does not reference a first-page schema.');
      if (repeatedIds.has(stableId)) fail('DUPLICATE_REPEAT_MARKER', markerPath, 'is marked more than once.');
      repeatedIds.add(stableId);
    });
  }

  const assets = recordValue(envelope.assetRevisionIds, 'canonical.envelope.assetRevisionIds');
  validateEnvelopeMapKeys(assets, schemaIds, 'canonical.envelope.assetRevisionIds');
  for (const [id, revisionId] of Object.entries(assets)) {
    const internalId = safeString(
      revisionId,
      `canonical.envelope.assetRevisionIds.${id}`,
      PDFME_V2_LIMITS.MAX_ASSET_REVISION_ID_LENGTH
    );
    if (!INTERNAL_ID_PATTERN.test(internalId)) {
      fail('INVALID_ASSET_REVISION_ID', `canonical.envelope.assetRevisionIds.${id}`, 'must be an internal revision identifier.');
    }
  }

  const revision = recordValue(envelope.revision, 'canonical.envelope.revision');
  assertKnownKeys(revision, ['activeRevisionId', 'baseRevisionId'], 'canonical.envelope.revision');
  for (const key of ['activeRevisionId', 'baseRevisionId'] as const) {
    if (revision[key] === null) continue;
    const revisionId = safeString(
      revision[key],
      `canonical.envelope.revision.${key}`,
      PDFME_V2_LIMITS.MAX_REVISION_ID_LENGTH
    );
    if (!INTERNAL_ID_PATTERN.test(revisionId)) {
      fail('INVALID_REVISION_ID', `canonical.envelope.revision.${key}`, 'must be an internal revision identifier.');
    }
  }

  try {
    checkTemplate(template as PdfmeV2CanonicalTemplate['template']);
  } catch (error) {
    fail('PDFME_TEMPLATE_INVALID', 'canonical.template', error instanceof Error ? error.message : 'is invalid.');
  }
  return candidate as PdfmeV2CanonicalTemplate;
}

function assertRenderText(value: unknown, path: string, maximum: number): string {
  return safeString(value, path, maximum);
}

function assertIsoDate(value: unknown, path: string, nullable = false): void {
  if (nullable && value === null) return;
  const text = assertRenderText(value, path, 64);
  if (!text || !Number.isFinite(Date.parse(text))) fail('INVALID_DATE', path, 'must be an ISO-compatible date.');
}

export function validateDocumentRenderData(value: unknown): DocumentRenderData {
  const candidate = parseAndBoundJson(
    value,
    'renderData',
    PDFME_V2_LIMITS.MAX_RENDER_DATA_JSON_BYTES
  );
  const data = recordValue(candidate, 'renderData');
  assertKnownKeys(
    data,
    [
      'documentType',
      'documentNumber',
      'issuedAt',
      'dueAt',
      'orderNumber',
      'orderedAt',
      'reference',
      'notes',
      'customer',
      'items',
      'totals'
    ],
    'renderData'
  );
  if (!isPdfmeV2DocumentType(data.documentType)) {
    fail('INVALID_DOCUMENT_TYPE', 'renderData.documentType', 'is not a generated v2 document type.');
  }
  assertRenderText(data.documentNumber, 'renderData.documentNumber', 256);
  assertIsoDate(data.issuedAt, 'renderData.issuedAt');
  assertIsoDate(data.dueAt, 'renderData.dueAt', true);
  assertRenderText(data.orderNumber, 'renderData.orderNumber', 256);
  assertIsoDate(data.orderedAt, 'renderData.orderedAt');
  assertRenderText(data.reference, 'renderData.reference', PDFME_V2_LIMITS.MAX_TEXT_FIELD_LENGTH);
  assertRenderText(data.notes, 'renderData.notes', PDFME_V2_LIMITS.MAX_NOTES_LENGTH);

  const customer = recordValue(data.customer, 'renderData.customer');
  assertKnownKeys(
    customer,
    [
      'type',
      'organizationName',
      'contactName',
      'email',
      'addressLines',
      'postalCode',
      'city',
      'countryCode'
    ],
    'renderData.customer'
  );
  for (const key of [
    'type',
    'organizationName',
    'contactName',
    'email',
    'postalCode',
    'city',
    'countryCode'
  ]) {
    assertRenderText(customer[key], `renderData.customer.${key}`, PDFME_V2_LIMITS.MAX_TEXT_FIELD_LENGTH);
  }
  if (!Array.isArray(customer.addressLines) || customer.addressLines.length > 8) {
    fail('INVALID_ADDRESS', 'renderData.customer.addressLines', 'must contain at most eight lines.');
  }
  customer.addressLines.forEach((line, index) =>
    assertRenderText(line, `renderData.customer.addressLines[${index}]`, PDFME_V2_LIMITS.MAX_TEXT_FIELD_LENGTH));

  if (!Array.isArray(data.items) || data.items.length > PDFME_V2_LIMITS.MAX_RENDER_ITEMS) {
    fail('TOO_MANY_ITEMS', 'renderData.items', `must contain at most ${PDFME_V2_LIMITS.MAX_RENDER_ITEMS} rows.`);
  }
  const lineNumbers = new Set<number>();
  data.items.forEach((itemValue, index) => {
    const path = `renderData.items[${index}]`;
    const item = recordValue(itemValue, path);
    assertKnownKeys(
      item,
      [
        'lineNumber',
        'sku',
        'productName',
        'variantName',
        'displayName',
        'unit',
        'quantity',
        'unitNet',
        'lineNet',
        'taxRate',
        'discountPercentage',
        'currency'
      ],
      path
    );
    const lineNumber = boundedNumber(item.lineNumber, `${path}.lineNumber`, 1, PDFME_V2_LIMITS.MAX_QUANTITY);
    if (!Number.isInteger(lineNumber) || lineNumbers.has(lineNumber)) {
      fail('INVALID_LINE_NUMBER', `${path}.lineNumber`, 'must be a unique positive integer.');
    }
    lineNumbers.add(lineNumber);
    assertRenderText(item.sku, `${path}.sku`, PDFME_V2_LIMITS.MAX_ITEM_SKU_LENGTH);
    for (const key of ['productName', 'variantName', 'displayName']) {
      assertRenderText(item[key], `${path}.${key}`, PDFME_V2_LIMITS.MAX_ITEM_NAME_LENGTH);
    }
    assertRenderText(item.unit, `${path}.unit`, 128);
    const quantity = boundedNumber(item.quantity, `${path}.quantity`, 1, PDFME_V2_LIMITS.MAX_QUANTITY);
    if (!Number.isInteger(quantity)) fail('INVALID_QUANTITY', `${path}.quantity`, 'must be an integer.');
    boundedNumber(item.unitNet, `${path}.unitNet`, 0, PDFME_V2_LIMITS.MAX_AMOUNT);
    boundedNumber(item.lineNet, `${path}.lineNet`, 0, PDFME_V2_LIMITS.MAX_AMOUNT);
    boundedNumber(item.taxRate, `${path}.taxRate`, 0, 100);
    boundedNumber(item.discountPercentage, `${path}.discountPercentage`, 0, 100);
    const currency = assertRenderText(item.currency, `${path}.currency`, 3);
    if (!/^[A-Z]{3}$/u.test(currency)) fail('INVALID_CURRENCY', `${path}.currency`, 'must be an ISO-style code.');
  });

  const totals = recordValue(data.totals, 'renderData.totals');
  assertKnownKeys(totals, ['subtotal', 'tax', 'shipping', 'total', 'currency'], 'renderData.totals');
  for (const key of ['subtotal', 'tax', 'shipping', 'total']) {
    boundedNumber(totals[key], `renderData.totals.${key}`, 0, PDFME_V2_LIMITS.MAX_AMOUNT);
  }
  const currency = assertRenderText(totals.currency, 'renderData.totals.currency', 3);
  if (!/^[A-Z]{3}$/u.test(currency)) fail('INVALID_CURRENCY', 'renderData.totals.currency', 'must be an ISO-style code.');
  return candidate as DocumentRenderData;
}

export function validateGeneratedPdfBytes(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) fail('INVALID_PDF_BYTES', 'pdf', 'must be a Uint8Array.');
  if (value.byteLength >= PDFME_V2_LIMITS.MAX_GENERATED_PDF_BYTES) {
    fail('PDF_TOO_LARGE', 'pdf', 'exceeds the 20 MB limit.');
  }
  const signature = new TextDecoder('ascii').decode(value.subarray(0, 5));
  if (signature !== '%PDF-') fail('INVALID_PDF_SIGNATURE', 'pdf', 'must begin with %PDF-.');
  return value;
}
