import assert from 'node:assert/strict';
import test from 'node:test';
import type { Schema } from '@pdfme/common';
import type { DesignerSelectedSchema, DesignerSelection } from '@pdfme/ui';

import { reconcilePdfmeV2SelectionSnapshot } from '../../src/admin/features/urejevalnik-v2/selectionSnapshotReconciliation';
import {
  clonePdfmeV2CanonicalTemplate,
  createDefaultPdfmeV2Template,
  type PdfmeV2CanonicalTemplate
} from '../../src/shared/domain/pdfmeV2';

function selectionFrom(
  canonical: PdfmeV2CanonicalTemplate,
  schemaIndexes: readonly number[]
): DesignerSelection {
  return {
    bounds: null,
    pageIndex: 0,
    schemas: schemaIndexes.map((schemaIndex) => {
      const schema = structuredClone(canonical.template.schemas[0][schemaIndex]);
      return {
        name: schema.name,
        pageIndex: 0,
        schema: schema as Schema,
        schemaId: `runtime-${schemaIndex}`,
        schemaIndex,
        type: schema.type
      };
    })
  };
}

test('public selection snapshot reconciles every selected schema after native undo', () => {
  const beforeBatch = createDefaultPdfmeV2Template('order_summary');
  const current = clonePdfmeV2CanonicalTemplate(beforeBatch);
  const selectedIndexes = [0, 2] as const;
  for (const schemaIndex of selectedIndexes) {
    current.template.schemas[0][schemaIndex].rotate = 127;
  }

  const reconciled = reconcilePdfmeV2SelectionSnapshot(
    current,
    selectionFrom(beforeBatch, selectedIndexes),
    () => {
      throw new Error(
        'a safely matched snapshot must not allocate a new atehnaId'
      );
    }
  );

  assert.notStrictEqual(reconciled, current);
  for (const schemaIndex of selectedIndexes) {
    assert.equal(current.template.schemas[0][schemaIndex].rotate, 127);
    assert.equal(
      reconciled.template.schemas[0][schemaIndex].rotate,
      beforeBatch.template.schemas[0][schemaIndex].rotate
    );
    assert.equal(
      reconciled.template.schemas[0][schemaIndex].atehnaId,
      current.template.schemas[0][schemaIndex].atehnaId
    );
  }
  assert.deepEqual(reconciled.envelope, current.envelope);
});

test('selection snapshot fails closed when any public identity field is stale', () => {
  const current = createDefaultPdfmeV2Template('order_summary');
  const mismatchCases: Array<
    (selected: DesignerSelectedSchema, selection: DesignerSelection) => void
  > = [
    (selected) => { selected.pageIndex = 1; },
    (selected) => { selected.schemaIndex += 1; },
    (selected) => { selected.name = 'staleName'; },
    (selected) => {
      (selected.schema as Schema & { atehnaId?: string }).atehnaId =
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    },
    (_selected, selection) => { selection.pageIndex = 1; }
  ];

  for (const mutate of mismatchCases) {
    const selection = selectionFrom(current, [0, 2]);
    mutate(selection.schemas[1], selection);
    assert.strictEqual(
      reconcilePdfmeV2SelectionSnapshot(
        current,
        selection,
        () => 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb'
      ),
      current
    );
  }

  assert.strictEqual(
    reconcilePdfmeV2SelectionSnapshot(
      current,
      { bounds: null, pageIndex: 0, schemas: [] },
      () => 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb'
    ),
    current
  );
});
