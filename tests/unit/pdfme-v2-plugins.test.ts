import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChangeSchemaItem, SchemaForUI } from '@pdfme/common';
import {
  ellipse,
  image,
  line,
  list,
  multiVariableText,
  rectangle,
  svg,
  table,
  text
} from '@pdfme/schemas';

import {
  PDFME_V2_MIXED_VALUE_LABEL,
  buildBatchChanges,
  classifyNumericDraft,
  commitNumericDraft,
  derivePropPanelSelection,
  formatPropPanelSelectionSummary,
  getBatchFieldAvailability,
  getBatchPropertyState
} from '../../src/shared/pdfmeV2/batchProperties';
import {
  PDFME_V2_PLUGINS,
  PDFME_V2_PLUGIN_TYPES
} from '../../src/shared/pdfmeV2/plugins';

const officialPlugins = {
  text,
  multiVariableText,
  image,
  svg,
  line,
  rectangle,
  ellipse,
  table,
  list
};

function schema(
  id: string,
  type: string,
  properties: Record<string, unknown> = {}
): SchemaForUI {
  return {
    id,
    name: id,
    type,
    content: '',
    position: { x: 0, y: 0 },
    width: 10,
    height: 10,
    ...properties
  } as SchemaForUI;
}

test('the shared registry allowlists exactly the required official plugin types', () => {
  assert.deepEqual(PDFME_V2_PLUGIN_TYPES, [
    'text',
    'multiVariableText',
    'image',
    'svg',
    'line',
    'rectangle',
    'ellipse',
    'table',
    'list'
  ]);
  assert.deepEqual(Object.keys(PDFME_V2_PLUGINS), PDFME_V2_PLUGIN_TYPES);

  for (const type of PDFME_V2_PLUGIN_TYPES) {
    const wrapped = PDFME_V2_PLUGINS[type];
    const official = officialPlugins[type];
    assert.equal(wrapped.pdf, official.pdf, `${type} keeps official PDF rendering`);
    assert.equal(wrapped.ui, official.ui, `${type} keeps official UI rendering`);
    assert.equal(
      wrapped.propPanel.defaultSchema,
      official.propPanel.defaultSchema,
      `${type} keeps the official default schema`
    );
    assert.notEqual(
      wrapped.propPanel,
      official.propPanel,
      `${type} changes only its property panel wrapper`
    );
    assert.equal(wrapped.propPanel.defaultSchema.type, type);
  }
});

test('selection is derived only from public active element ids and schemas', () => {
  const schemas = [
    schema('first', 'text'),
    schema('second', 'image'),
    schema('third', 'rectangle')
  ];
  const selected = derivePropPanelSelection({
    activeElements: [{ id: 'third' }, { id: 'missing' }, { id: 'first' }],
    schemas
  });

  assert.deepEqual(
    selected.map(({ id }) => id),
    ['first', 'third'],
    'canonical schema order is retained without a second selection model'
  );
  assert.equal(
    formatPropPanelSelectionSummary(selected),
    '2 izbrana elementa: Besedilo (1), Pravokotnik (1).'
  );
});

test('shared fields expose explicit uniform and mixed values', () => {
  const selected = [
    schema('copy', 'text', { opacity: 0.35, rotate: 15 }),
    schema('photo', 'image', { opacity: 0.8, rotate: 15 })
  ];

  assert.deepEqual(getBatchPropertyState(selected, 'rotate'), {
    enabled: true,
    selectedCount: 2,
    selectedTypes: ['text', 'image'],
    mixed: false,
    value: 15,
    placeholder: undefined
  });
  assert.deepEqual(getBatchPropertyState(selected, 'opacity'), {
    enabled: true,
    selectedCount: 2,
    selectedTypes: ['text', 'image'],
    mixed: true,
    value: undefined,
    placeholder: PDFME_V2_MIXED_VALUE_LABEL
  });
});

test('font size supports heterogeneous typography and incompatible fields explain why', () => {
  const sameTypeText = [
    schema('one', 'text', { fontSize: 10 }),
    schema('two', 'text', { fontSize: 12 })
  ];
  const compatibleTypography = [
    sameTypeText[0],
    schema('variable', 'multiVariableText', { fontSize: 11 }),
    schema('bullets', 'list', { fontSize: 12 })
  ];
  const crossType = [sameTypeText[0], schema('photo', 'image', { opacity: 1 })];
  const tableSelection = [sameTypeText[0], schema('items', 'table')];

  assert.equal(getBatchFieldAvailability(sameTypeText, 'fontSize').enabled, true);
  assert.equal(
    getBatchFieldAvailability(compatibleTypography, 'fontSize').enabled,
    true
  );

  const fontAvailability = getBatchFieldAvailability(crossType, 'fontSize');
  assert.equal(fontAvailability.enabled, false);
  assert.match(fontAvailability.reason ?? '', /tipografski/u);

  const opacityAvailability = getBatchFieldAvailability(
    tableSelection,
    'opacity'
  );
  assert.equal(opacityAvailability.enabled, false);
  assert.match(opacityAvailability.reason ?? '', /Tabela/u);
  assert.deepEqual(buildBatchChanges(tableSelection, 'opacity', 0.5), []);
});

test('numeric drafts preserve partial, decimal, and multi-digit input until commit', () => {
  for (const draft of ['', '-', '+', '.', '-.', '1.', '-12.']) {
    assert.deepEqual(classifyNumericDraft(draft), { status: 'draft', draft });
  }
  assert.deepEqual(classifyNumericDraft('0.625'), {
    status: 'valid',
    draft: '0.625',
    value: 0.625
  });
  assert.deepEqual(classifyNumericDraft('120'), {
    status: 'valid',
    draft: '120',
    value: 120
  });
  assert.deepEqual(classifyNumericDraft('1..2'), {
    status: 'invalid',
    draft: '1..2'
  });
});

test('a valid batch draft calls changeSchemas once with every compatible change', () => {
  const selected = [
    schema('copy', 'text', { opacity: 0.2 }),
    schema('photo', 'image', { opacity: 0.7 })
  ];
  const calls: ChangeSchemaItem[][] = [];
  const changeSchemas = (changes: ChangeSchemaItem[]) => calls.push(changes);

  for (const draft of ['', '-', '1.']) {
    assert.equal(
      commitNumericDraft({
        draft,
        schemas: selected,
        property: 'opacity',
        changeSchemas
      }),
      false
    );
  }
  assert.equal(calls.length, 0, 'typing drafts do not mutate schemas');

  assert.equal(
    commitNumericDraft({
      draft: '0.65',
      schemas: selected,
      property: 'opacity',
      changeSchemas
    }),
    true
  );
  assert.equal(calls.length, 1, 'the native callback is invoked once');
  assert.deepEqual(calls[0], [
    { key: 'opacity', value: 0.65, schemaId: 'copy' },
    { key: 'opacity', value: 0.65, schemaId: 'photo' }
  ]);
});

test('multi-digit same-type typography commits as one complete batch', () => {
  const selected = [schema('one', 'text'), schema('two', 'text')];
  const calls: ChangeSchemaItem[][] = [];

  assert.equal(
    commitNumericDraft({
      draft: '128',
      schemas: selected,
      property: 'fontSize',
      changeSchemas: (changes) => calls.push(changes)
    }),
    true
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    { key: 'fontSize', value: 128, schemaId: 'one' },
    { key: 'fontSize', value: 128, schemaId: 'two' }
  ]);
});
