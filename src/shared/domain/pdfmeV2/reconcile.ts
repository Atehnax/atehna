import { cloneDeep } from '@pdfme/common';
import type { Schema, Template } from '@pdfme/common';

import { isPdfmeV2AllowedBinding, type PdfmeV2BindingName } from './bindings';
import {
  PDFME_V2_ENGINE_VERSION,
  PDFME_V2_SCHEMA_VERSION,
  type AtehnaId,
  type AtehnaPdfmeSchema,
  type PdfmeV2CanonicalTemplate,
  type PdfmeV2SchemaType
} from './template';

export type PdfmeV2AtehnaIdFactory = () => AtehnaId;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TRANSIENT_SCHEMA_KEYS = ['id', '__splitRange', '__isSplit'] as const;

const SLOVENE_SCHEMA_LABELS: Readonly<Record<PdfmeV2SchemaType, string>> = {
  text: 'Besedilo',
  multiVariableText: 'Dinamično besedilo',
  image: 'Slika',
  svg: 'Vektorska slika',
  line: 'Črta',
  rectangle: 'Pravokotnik',
  ellipse: 'Elipsa',
  table: 'Tabela',
  list: 'Seznam'
};

function schemaId(value: Schema): string | null {
  const candidate = (value as Record<string, unknown>).atehnaId;
  return typeof candidate === 'string' && UUID_PATTERN.test(candidate)
    ? candidate
    : null;
}

function schemaName(value: Schema): string | null {
  return typeof value.name === 'string' && value.name ? value.name : null;
}

function newUniqueId(
  createId: PdfmeV2AtehnaIdFactory,
  usedIds: ReadonlySet<string>
): AtehnaId {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const candidate = createId();
    if (UUID_PATTERN.test(candidate) && !usedIds.has(candidate)) return candidate;
  }
  throw new TypeError('The atehnaId factory did not produce a unique RFC 4122 UUID.');
}

function uniqueCurrentIds(current: PdfmeV2CanonicalTemplate) {
  const counts = new Map<string, number>();
  for (const schema of current.template.schemas.flat()) {
    const id = schemaId(schema);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count === 1)
      .map(([id]) => id)
  );
}

function currentIdByUniqueName(current: PdfmeV2CanonicalTemplate) {
  const idsByName = new Map<string, string[]>();
  for (const schema of current.template.schemas.flat()) {
    const id = schemaId(schema);
    const name = schemaName(schema);
    if (!id || !name) continue;
    idsByName.set(name, [...(idsByName.get(name) ?? []), id]);
  }
  return new Map(
    [...idsByName.entries()]
      .filter(([, ids]) => ids.length === 1)
      .map(([name, ids]) => [name, ids[0]])
  );
}

function deriveBindings(schema: AtehnaPdfmeSchema): readonly PdfmeV2BindingName[] {
  const bindings: PdfmeV2BindingName[] = [];
  const add = (value: unknown) => {
    if (isPdfmeV2AllowedBinding(value) && !bindings.includes(value)) bindings.push(value);
  };
  const placeholderValues = [
    schema.type === 'multiVariableText'
      ? (schema as Record<string, unknown>).text
      : schema.content
  ];
  for (const value of placeholderValues) {
    if (typeof value !== 'string') continue;
    for (const match of value.matchAll(/\{([^{}]+)\}/gu)) add(match[1].trim());
  }
  const variables = (schema as Record<string, unknown>).variables;
  if (Array.isArray(variables)) variables.forEach(add);
  if (
    schema.readOnly !== true
    && schema.type !== 'line'
    && schema.type !== 'rectangle'
    && schema.type !== 'ellipse'
  ) {
    add(schema.name);
  }
  return bindings;
}

function defaultLabel(schema: AtehnaPdfmeSchema): string {
  return SLOVENE_SCHEMA_LABELS[schema.type] ?? 'Element';
}

/**
 * Reconciles a Designer serialization back into the single canonical value.
 * It owns no mutable layout state: schema order and every layout/style field
 * come directly from nextTemplate.
 */
export function reconcilePdfmeV2DesignerTemplate(
  currentCanonical: PdfmeV2CanonicalTemplate,
  nextTemplate: Template,
  createId: PdfmeV2AtehnaIdFactory
): PdfmeV2CanonicalTemplate {
  const template = cloneDeep(nextTemplate) as Template;
  const validCurrentIds = uniqueCurrentIds(currentCanonical);
  const byName = currentIdByUniqueName(currentCanonical);
  const currentNamesById = new Map(
    currentCanonical.template.schemas.flat().flatMap((schema) => {
      const id = schemaId(schema);
      const name = schemaName(schema);
      return id && name ? [[id, name] as const] : [];
    })
  );
  const usedIds = new Set<string>();
  const sourceIdByAssignedId = new Map<string, string>();
  const firstAssignedIdForSource = new Map<string, string>();

  const schemas = template.schemas.map((page) => page.map((rawSchema) => {
    const schema = rawSchema as Schema & Record<string, unknown>;
    const embeddedId = schemaId(schema);
    const nextName = schemaName(schema);
    const nameMatchedId = nextName === null
      ? null
      : byName.get(nextName) ?? null;
    const embeddedMatchesOriginalName = embeddedId !== null
      && currentNamesById.get(embeddedId) === nextName;
    const reusableId = nameMatchedId && validCurrentIds.has(nameMatchedId) && !usedIds.has(nameMatchedId)
      ? nameMatchedId
      : embeddedId && embeddedMatchesOriginalName && validCurrentIds.has(embeddedId) && !usedIds.has(embeddedId)
        ? embeddedId
        : null;
    const assignedId = reusableId ?? newUniqueId(createId, usedIds);
    const sourceId = embeddedId && validCurrentIds.has(embeddedId)
      ? embeddedId
      : nameMatchedId && validCurrentIds.has(nameMatchedId)
        ? nameMatchedId
        : assignedId;

    for (const key of TRANSIENT_SCHEMA_KEYS) delete schema[key];
    schema.atehnaId = assignedId;
    usedIds.add(assignedId);
    sourceIdByAssignedId.set(assignedId, sourceId);
    if (!firstAssignedIdForSource.has(sourceId)) {
      firstAssignedIdForSource.set(sourceId, assignedId);
    }
    return schema as AtehnaPdfmeSchema;
  }));

  if (
    typeof template.basePdf === 'object'
    && template.basePdf !== null
    && !ArrayBuffer.isView(template.basePdf)
    && !(template.basePdf instanceof ArrayBuffer)
  ) {
    delete (template.basePdf as Record<string, unknown>).staticSchema;
  }

  const labels: Record<string, string> = {};
  const bindings: Record<string, readonly PdfmeV2BindingName[]> = {};
  const visibilityConditions: Record<string, PdfmeV2CanonicalTemplate['envelope']['visibilityConditions'][string]> = {};
  const assetRevisionIds: Record<string, string> = {};
  for (const schema of schemas.flat()) {
    const sourceId = sourceIdByAssignedId.get(schema.atehnaId) ?? schema.atehnaId;
    labels[schema.atehnaId] = currentCanonical.envelope.labels[sourceId]
      ?? defaultLabel(schema);
    const derived = deriveBindings(schema);
    if (derived.length > 0) bindings[schema.atehnaId] = derived;
    const visibility = currentCanonical.envelope.visibilityConditions[sourceId];
    if (visibility) visibilityConditions[schema.atehnaId] = visibility;
    const assetRevisionId = currentCanonical.envelope.assetRevisionIds[sourceId];
    if (assetRevisionId) assetRevisionIds[schema.atehnaId] = assetRevisionId;
  }

  const reconcileMarkers = (ids: readonly string[]) => ids.flatMap((sourceId) => {
    const assignedId = firstAssignedIdForSource.get(sourceId);
    return assignedId && usedIds.has(assignedId) ? [assignedId] : [];
  });

  return {
    template: {
      ...template,
      schemas,
      pdfmeVersion: PDFME_V2_ENGINE_VERSION
    } as PdfmeV2CanonicalTemplate['template'],
    envelope: {
      schemaVersion: PDFME_V2_SCHEMA_VERSION,
      pdfmeVersion: PDFME_V2_ENGINE_VERSION,
      documentType: currentCanonical.envelope.documentType,
      labels,
      bindings,
      visibilityConditions,
      repeating: {
        header: reconcileMarkers(currentCanonical.envelope.repeating.header),
        footer: reconcileMarkers(currentCanonical.envelope.repeating.footer)
      },
      assetRevisionIds,
      revision: cloneDeep(currentCanonical.envelope.revision)
    }
  };
}
