import {
  resolveOrderDocumentCanvas,
  resolveOrderDocumentDecoration,
  resolveOrderDocumentDecorationInset,
  resolveOrderDocumentFieldRows,
  resolveOrderDocumentTable,
  resolveOrderDocumentTableRowHeight,
  resolveOrderDocumentTypography,
  type OrderDocumentCanvasElementId,
  type OrderDocumentFieldGroupId,
  type OrderDocumentTemplate
} from './orderDocumentTemplates';
import {
  resolveOrderDocumentItemCells,
  resolveOrderDocumentItemSections,
  resolveOrderDocumentPreviewText,
  resolveOrderDocumentTotalRows,
  type OrderDocumentPreviewContext
} from './orderDocumentPreview';

const MIN_ELEMENT_SIZE_MM = 5;
const PT_TO_MM = 25.4 / 72;
const MM_TO_PT = 72 / 25.4;

export const ORDER_DOCUMENT_FLOW_SECTION_GAP_PT = 8;
export const ORDER_DOCUMENT_FLOW_SECTION_GAP_MM =
  ORDER_DOCUMENT_FLOW_SECTION_GAP_PT * PT_TO_MM;

const roundMm = (value: number) => Math.round(value * 10) / 10;

function estimateLineCount(value: string, widthMm: number, fontSizePt: number) {
  if (!value.trim()) return 0;
  const charactersPerLine = Math.max(
    1,
    Math.floor((widthMm * MM_TO_PT) / Math.max(1, fontSizePt * 0.52))
  );
  return value.split(/\r?\n/u).reduce(
    (count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)),
    0
  );
}

function visibleRows(template: OrderDocumentTemplate, group: OrderDocumentFieldGroupId) {
  return resolveOrderDocumentFieldRows(template, group).filter((row) => row.visible);
}

function placedRowsHeightMm(
  template: OrderDocumentTemplate,
  group: OrderDocumentFieldGroupId
) {
  return visibleRows(template, group).reduce(
    (height, row) => Math.max(
      height,
      row.placement
        ? (row.placement.yMm ?? 0) + (row.placement.heightMm ?? MIN_ELEMENT_SIZE_MM)
        : 0
    ),
    0
  );
}

/**
 * Conservative sizing for the PDF renderer's enclosing flow decorations.
 * Interactive editor geometry comes exclusively from the rendered PDF manifest.
 */
export function estimateOrderDocumentFlowElementHeightMm(
  template: OrderDocumentTemplate,
  previewContext: OrderDocumentPreviewContext,
  id: OrderDocumentCanvasElementId,
  widthMm: number
) {
  if (id === 'intro') {
    const value = resolveOrderDocumentPreviewText(template.text.intro, template, previewContext);
    if (!value) return 0;
    const typography = resolveOrderDocumentTypography(template, { kind: 'element', elementId: id });
    const decoration = resolveOrderDocumentDecoration(template, { kind: 'element', elementId: id });
    const insetPt = resolveOrderDocumentDecorationInset(decoration);
    const innerWidthMm = Math.max(
      1,
      widthMm - (insetPt * 2 + (decoration.accentEnabled ? decoration.accentWidthPt : 0)) * PT_TO_MM
    );
    const lines = estimateLineCount(value, innerWidthMm, typography.fontSizePt);
    return roundMm(Math.max(
      24,
      lines * typography.fontSizePt * 1.45 + insetPt * 2
    ) * PT_TO_MM);
  }

  if (id === 'items') {
    const table = resolveOrderDocumentTable(template);
    const columns = table.columns.filter((column) => column.visible);
    const totalRatio = columns.reduce((sum, column) => sum + column.widthRatio, 0) || 1;
    const headerHeightPt = Math.max(
      table.headerHeightPt,
      ...columns.map((column) => resolveOrderDocumentTypography(
        template,
        { kind: 'table_header_cell', columnId: column.id }
      ).fontSizePt + template.style.rowPaddingPt * 2 + 2)
    );
    const description = columns.find((column) => column.id === 'description');
    const descriptionWidthMm = description
      ? widthMm * (description.widthRatio / totalRatio)
      : widthMm;
    const sections = resolveOrderDocumentItemSections(
      previewContext.type,
      previewContext.items
    );
    let rowNumber = 0;
    const rowsHeightPt = sections.reduce((sectionSum, section) => (
      sectionSum + section.items.reduce((sum, item) => {
        rowNumber += 1;
        const descriptionColumnId = description?.id ?? columns[0]?.id ?? 'description';
        const typography = resolveOrderDocumentTypography(template, {
          kind: 'table_cell',
          columnId: descriptionColumnId,
          rowNumber
        });
        const descriptionText = resolveOrderDocumentItemCells(item).description;
        const lines = Math.max(
          1,
          estimateLineCount(descriptionText, Math.max(1, descriptionWidthMm - 3.5), typography.fontSizePt)
        );
        const naturalHeightPt = Math.max(
          lines * typography.fontSizePt * 1.35 + template.style.rowPaddingPt * 2,
          ...columns.map((column) => resolveOrderDocumentTypography(template, {
            kind: 'table_cell',
            columnId: column.id,
            rowNumber
          }).fontSizePt * 1.35 + template.style.rowPaddingPt * 2)
        );
        return sum + Math.max(resolveOrderDocumentTableRowHeight(table, rowNumber), naturalHeightPt)
          + table.rowGapPt;
      }, 0)
    ), 0);
    const itemTypography = resolveOrderDocumentTypography(template, {
      kind: 'element',
      elementId: 'items'
    });
    const sectionLabelsHeightPt = sections.reduce((sum, section, index) => (
      section.label
        ? sum + itemTypography.fontSizePt * 1.35 + 3 + (index > 0 ? 10 : 0)
        : sum
    ), 0);
    return roundMm((
      headerHeightPt * sections.length
      + rowsHeightPt
      + sectionLabelsHeightPt
    ) * PT_TO_MM);
  }

  if (id === 'totals') {
    const rows = resolveOrderDocumentTotalRows(template, previewContext);
    if (rows.length === 0) return 0;
    const naturalHeightMm = rows.reduce((height, row) => {
      const typography = resolveOrderDocumentTypography(template, {
        kind: 'field_row',
        group: 'totals',
        rowId: row.id
      });
      const insetPt = resolveOrderDocumentDecorationInset(
        resolveOrderDocumentDecoration(template, {
          kind: 'field_row', group: 'totals', rowId: row.id
        })
      );
      return height + (typography.fontSizePt * 1.7 + insetPt * 2) * PT_TO_MM;
    }, 0);
    return roundMm(Math.max(naturalHeightMm, placedRowsHeightMm(template, 'totals')));
  }

  if (id === 'notes') {
    const notes = previewContext.order.notes?.trim() ?? '';
    if (!notes) return 0;
    const rows = visibleRows(template, 'notes');
    if (rows.length === 0) return 0;
    const label = rows.find((row) => row.id === 'notes_label');
    const content = rows.find((row) => row.id === 'notes_content');
    const labelHeightPt = label
      ? (() => {
          const typography = resolveOrderDocumentTypography(template, {
            kind: 'field_row', group: 'notes', rowId: label.id
          });
          const insetPt = resolveOrderDocumentDecorationInset(
            resolveOrderDocumentDecoration(template, {
              kind: 'field_row', group: 'notes', rowId: label.id
            })
          );
          return typography.fontSizePt * 1.55 + insetPt * 2;
        })()
      : 0;
    const contentTypography = content
      ? resolveOrderDocumentTypography(template, {
          kind: 'field_row', group: 'notes', rowId: content.id
        })
      : null;
    const contentDecoration = content
      ? resolveOrderDocumentDecoration(template, {
          kind: 'field_row', group: 'notes', rowId: content.id
        })
      : null;
    const contentInsetPt = contentDecoration
      ? resolveOrderDocumentDecorationInset(contentDecoration)
      : 0;
    const contentHeightPt = contentTypography
      ? estimateLineCount(
          notes,
          Math.max(1, widthMm - contentInsetPt * 2 * PT_TO_MM),
          contentTypography.fontSizePt
        ) * contentTypography.fontSizePt * 1.45 + contentInsetPt * 2
      : 0;
    return roundMm(Math.max(
      (labelHeightPt + contentHeightPt) * PT_TO_MM,
      placedRowsHeightMm(template, 'notes')
    ));
  }

  if (id === 'closing') {
    const values = new Map([
      ['payment_terms', resolveOrderDocumentPreviewText(template.text.paymentTerms, template, previewContext)],
      ['closing_text', resolveOrderDocumentPreviewText(template.text.closing, template, previewContext)],
      ['signer_name', resolveOrderDocumentPreviewText(template.text.signerName, template, previewContext)]
    ]);
    const heightPt = visibleRows(template, 'closing').reduce((height, row) => {
      const value = values.get(row.id) ?? '';
      if (!value) return height;
      const typography = resolveOrderDocumentTypography(template, {
        kind: 'field_row', group: 'closing', rowId: row.id
      });
      const insetPt = resolveOrderDocumentDecorationInset(
        resolveOrderDocumentDecoration(template, {
          kind: 'field_row', group: 'closing', rowId: row.id
        })
      );
      return height + estimateLineCount(
        value,
        Math.max(1, widthMm - insetPt * 2 * PT_TO_MM),
        typography.fontSizePt
      ) * typography.fontSizePt * 1.45 + insetPt * 2;
    }, 0);
    if (heightPt === 0) return 0;
    return roundMm(Math.max(heightPt * PT_TO_MM, placedRowsHeightMm(template, 'closing')));
  }

  if (id === 'signatures') {
    return visibleRows(template, 'signatures').length > 0
      ? roundMm(Math.max(55 * PT_TO_MM, placedRowsHeightMm(template, 'signatures')))
      : 0;
  }

  return resolveOrderDocumentCanvas(template).elements[id].heightMm;
}
