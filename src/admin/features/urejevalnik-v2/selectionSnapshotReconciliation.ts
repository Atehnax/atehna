import { cloneDeep } from '@pdfme/common';
import type { Schema, Template } from '@pdfme/common';
import type { DesignerSelectedSchema, DesignerSelection } from '@pdfme/ui';

import {
  reconcilePdfmeV2DesignerTemplate,
  type PdfmeV2AtehnaIdFactory,
  type PdfmeV2CanonicalTemplate
} from '@/shared/domain/pdfmeV2';

function stringProperty(value: unknown, property: string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === 'string' ? candidate : null;
}

function selectionEntryMatchesCanonical(
  currentCanonical: PdfmeV2CanonicalTemplate,
  selectionPageIndex: number,
  selected: DesignerSelectedSchema
): boolean {
  if (
    !Number.isInteger(selected.pageIndex)
    || selected.pageIndex < 0
    || selected.pageIndex !== selectionPageIndex
    || !Number.isInteger(selected.schemaIndex)
    || selected.schemaIndex < 0
  ) return false;

  const currentSchema =
    currentCanonical.template.schemas[selected.pageIndex]?.[selected.schemaIndex];
  if (!currentSchema) return false;
  const currentId = stringProperty(currentSchema, 'atehnaId');
  const selectedId = stringProperty(selected.schema, 'atehnaId');
  return currentId !== null
    && selectedId === currentId
    && selected.name === currentSchema.name
    && stringProperty(selected.schema, 'name') === currentSchema.name
    && selected.type === currentSchema.type
    && stringProperty(selected.schema, 'type') === currentSchema.type;
}

export function reconcilePdfmeV2SelectionSnapshot(
  currentCanonical: PdfmeV2CanonicalTemplate,
  selection: DesignerSelection,
  createId: PdfmeV2AtehnaIdFactory,
): PdfmeV2CanonicalTemplate {
  if (
    selection.schemas.length === 0
    || !Number.isInteger(selection.pageIndex)
    || selection.pageIndex < 0
  ) return currentCanonical;

  const seenLocations = new Set<string>();
  for (const selected of selection.schemas) {
    const location = `${selected.pageIndex}:${selected.schemaIndex}`;
    if (
      seenLocations.has(location)
      || !selectionEntryMatchesCanonical(
        currentCanonical,
        selection.pageIndex,
        selected,
      )
    ) return currentCanonical;
    seenLocations.add(location);
  }

  const nextTemplate = cloneDeep(currentCanonical.template) as Template;
  for (const selected of selection.schemas) {
    const currentSchema =
      currentCanonical.template.schemas[selected.pageIndex][selected.schemaIndex];
    const replacement = cloneDeep(selected.schema) as Schema &
      Record<string, unknown>;
    replacement.atehnaId = currentSchema.atehnaId;
    nextTemplate.schemas[selected.pageIndex][selected.schemaIndex] = replacement;
  }
  return reconcilePdfmeV2DesignerTemplate(
    currentCanonical,
    nextTemplate,
    createId,
  );
}
