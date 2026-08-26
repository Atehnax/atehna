import type {
  OrderDocumentCanvasElementId,
  OrderDocumentFieldGroupId,
  OrderDocumentFieldRowId,
  OrderDocumentTableColumnId,
  OrderDocumentTemplate,
  OrderDocumentTemplateCompany,
  OrderDocumentTemplateLabels,
  OrderDocumentTemplateText,
  OrderDocumentTextAlignment,
  OrderDocumentResolvedTextAlignment,
  OrderDocumentTypography,
  OrderDocumentTypographyTarget
} from '@/shared/domain/order/orderDocumentTemplates';
import {
  getOrderDocumentTextAlignmentOverride,
  orderDocumentTypographyTargetKey,
  resetOrderDocumentTextAlignment,
  resetOrderDocumentTypography,
  resolveOrderDocumentTextAlignment,
  resolveOrderDocumentTypography,
  setOrderDocumentTextAlignment,
  setOrderDocumentTypography
} from '@/shared/domain/order/orderDocumentTemplates';

export type OrderDocumentCompanyTextKey = {
  [Key in keyof OrderDocumentTemplateCompany]-?: OrderDocumentTemplateCompany[Key] extends string
    ? Key
    : never;
}[keyof OrderDocumentTemplateCompany];

export type OrderDocumentCanvasChildSelection =
  | {
      id: string;
      parentId: OrderDocumentCanvasElementId;
      kind: 'label';
      key: keyof OrderDocumentTemplateLabels;
    }
  | {
      id: string;
      parentId: OrderDocumentCanvasElementId;
      kind: 'text';
      key: keyof Omit<OrderDocumentTemplateText, 'labels'>;
    }
  | {
      id: string;
      parentId: OrderDocumentCanvasElementId;
      kind: 'company';
      key: OrderDocumentCompanyTextKey;
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_header';
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_body';
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_header_cell';
      key: OrderDocumentTableColumnId;
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_column';
      key: OrderDocumentTableColumnId;
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_row';
      rowNumber: number;
    }
  | {
      id: string;
      parentId: 'items';
      kind: 'table_cell';
      rowNumber: number;
      key: OrderDocumentTableColumnId;
    }
  | {
      id: string;
      parentId: 'company';
      kind: 'company_contact';
      contactId: string;
    }
  | {
      id: string;
      parentId: OrderDocumentFieldGroupId;
      kind: 'field_row';
      group: OrderDocumentFieldGroupId;
      rowId: OrderDocumentFieldRowId;
    };

export type OrderDocumentCanvasSelectionEntry =
  | {
      key: `element:${OrderDocumentCanvasElementId}`;
      kind: 'element';
      elementId: OrderDocumentCanvasElementId;
    }
  | {
      key: `child:${string}`;
      kind: 'child';
      child: OrderDocumentCanvasChildSelection;
    };

export type OrderDocumentCanvasSelectionAction =
  | { type: 'replace'; entry: OrderDocumentCanvasSelectionEntry }
  | { type: 'toggle'; entry: OrderDocumentCanvasSelectionEntry }
  | { type: 'clear' };

export const orderDocumentElementSelection = (
  elementId: OrderDocumentCanvasElementId
): OrderDocumentCanvasSelectionEntry => ({
  key: `element:${elementId}`,
  kind: 'element',
  elementId
});

export const orderDocumentChildSelection = (
  child: OrderDocumentCanvasChildSelection
): OrderDocumentCanvasSelectionEntry => ({
  key: `child:${child.id}`,
  kind: 'child',
  child
});

/**
 * Keeps insertion order stable so the last entry is always the primary target.
 * Additive selection is a true toggle: selecting an existing target removes it,
 * while selecting a new target appends it without duplicating prior entries.
 */
export function reduceOrderDocumentCanvasSelection(
  current: readonly OrderDocumentCanvasSelectionEntry[],
  action: OrderDocumentCanvasSelectionAction
): readonly OrderDocumentCanvasSelectionEntry[] {
  if (action.type === 'clear') return [];
  if (action.type === 'replace') return [action.entry];
  const existingIndex = current.findIndex((entry) => entry.key === action.entry.key);
  if (existingIndex < 0) return [...current, action.entry];
  return current.filter((_, index) => index !== existingIndex);
}

const NON_TYPOGRAPHIC_ELEMENT_IDS = new Set<OrderDocumentCanvasElementId>([
  'header',
  'document_details',
  'logo'
]);

export function orderDocumentSelectionTypographyTarget(
  entry: OrderDocumentCanvasSelectionEntry
): OrderDocumentTypographyTarget | null {
  if (entry.kind === 'element') {
    return NON_TYPOGRAPHIC_ELEMENT_IDS.has(entry.elementId)
      ? null
      : { kind: 'element', elementId: entry.elementId };
  }
  const selection = entry.child;
  if (selection.kind === 'field_row') {
    return { kind: 'field_row', group: selection.group, rowId: selection.rowId };
  }
  if (selection.kind === 'company_contact') {
    return { kind: 'company_contact', contactId: selection.contactId };
  }
  if (selection.kind === 'table_header') return { kind: 'table_header' };
  if (selection.kind === 'table_body') return { kind: 'table_body' };
  if (selection.kind === 'table_header_cell') {
    return { kind: 'table_header_cell', columnId: selection.key };
  }
  if (selection.kind === 'table_column') {
    return { kind: 'table_column', columnId: selection.key };
  }
  if (selection.kind === 'table_row') {
    return { kind: 'table_row', rowNumber: selection.rowNumber };
  }
  if (selection.kind === 'table_cell') {
    return {
      kind: 'table_cell',
      rowNumber: selection.rowNumber,
      columnId: selection.key
    };
  }
  return { kind: 'element', elementId: selection.parentId };
}

export function resolveOrderDocumentSelectionTypographyTargets(
  entries: readonly OrderDocumentCanvasSelectionEntry[]
): readonly OrderDocumentTypographyTarget[] {
  const targets = new Map<string, OrderDocumentTypographyTarget>();
  for (const entry of entries) {
    const target = orderDocumentSelectionTypographyTarget(entry);
    if (target) targets.set(orderDocumentTypographyTargetKey(target), target);
  }
  return [...targets.values()];
}

export type OrderDocumentMixedTypographyState = {
  [Key in keyof OrderDocumentTypography]: {
    value: OrderDocumentTypography[Key];
    mixed: boolean;
  };
};

export function resolveOrderDocumentMixedTypography(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[]
): OrderDocumentMixedTypographyState | null {
  if (targets.length === 0) return null;
  const values = targets.map((target) => resolveOrderDocumentTypography(template, target));
  const first = values[0];
  return {
    fontFamily: {
      value: first.fontFamily,
      mixed: values.some((value) => value.fontFamily !== first.fontFamily)
    },
    fontWeight: {
      value: first.fontWeight,
      mixed: values.some((value) => value.fontWeight !== first.fontWeight)
    },
    fontStyle: {
      value: first.fontStyle,
      mixed: values.some((value) => value.fontStyle !== first.fontStyle)
    },
    fontSizePt: {
      value: first.fontSizePt,
      mixed: values.some((value) => value.fontSizePt !== first.fontSizePt)
    }
  };
}

export function applyOrderDocumentTypographyToTargets(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[],
  updates: Partial<OrderDocumentTypography>
): OrderDocumentTemplate {
  return targets.reduce(
    (current, target) => setOrderDocumentTypography(current, target, updates),
    template
  );
}

export function resetOrderDocumentTypographyTargets(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[]
): OrderDocumentTemplate {
  return targets.reduce(
    (current, target) => resetOrderDocumentTypography(current, target),
    template
  );
}

export type OrderDocumentMixedTextAlignmentState = {
  value: OrderDocumentResolvedTextAlignment;
  mixed: boolean;
  overrideState: 'automatic' | 'explicit' | 'mixed';
};

/**
 * Resolves the visible value and the sparse override state independently.
 * This matters when two targets both look left-aligned but only one has an
 * explicit override: the batch control must still describe that state as mixed.
 */
export function resolveOrderDocumentMixedTextAlignment(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[]
): OrderDocumentMixedTextAlignmentState | null {
  if (targets.length === 0) return null;
  const values = targets.map((target) => resolveOrderDocumentTextAlignment(template, target));
  const overrides = targets.map((target) =>
    getOrderDocumentTextAlignmentOverride(template, target)
  );
  const explicitCount = overrides.filter((alignment) => alignment !== undefined).length;
  return {
    value: values[0],
    mixed: values.some((value) => value !== values[0]),
    overrideState: explicitCount === 0
      ? 'automatic'
      : explicitCount === overrides.length
        ? 'explicit'
        : 'mixed'
  };
}

export function applyOrderDocumentTextAlignmentToTargets(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[],
  alignment: OrderDocumentTextAlignment
): OrderDocumentTemplate {
  return targets.reduce(
    (current, target) => setOrderDocumentTextAlignment(current, target, alignment),
    template
  );
}

export function resetOrderDocumentTextAlignmentTargets(
  template: OrderDocumentTemplate,
  targets: readonly OrderDocumentTypographyTarget[]
): OrderDocumentTemplate {
  return targets.reduce(
    (current, target) => resetOrderDocumentTextAlignment(current, target),
    template
  );
}
