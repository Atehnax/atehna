import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR,
  cycleOrderDocumentSelectionCandidate,
  normalizeOrderDocumentSelectionHitStack,
  resolveOrderDocumentSelectionCandidates,
  resolveOrderDocumentSelectionCandidatesFromHitStack,
  type OrderDocumentSelectionDomNode
} from '../../src/admin/features/urejevalnik/lib/orderDocumentOverlapSelection';

class FakeNode implements OrderDocumentSelectionDomNode {
  constructor(
    private readonly attributes: Readonly<Record<string, string>> = {},
    private readonly ancestors: Readonly<Record<string, FakeNode>> = {}
  ) {}

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  closest(selector: string): FakeNode | null {
    if (selector.includes('[data-order-document-selection-chrome]')) {
      return this.attributes['data-order-document-selection-chrome'] !== undefined
        ? this
        : this.ancestors.chrome ?? null;
    }
    if (selector === '[data-order-document-child-id]') {
      return this.attributes['data-order-document-child-id'] !== undefined
        ? this
        : this.ancestors.child ?? null;
    }
    if (selector === '[data-order-document-element-id]') {
      return this.attributes['data-order-document-element-id'] !== undefined
        ? this
        : this.ancestors.element ?? null;
    }
    return null;
  }
}

test('overlap candidates keep a child and its owner separately, in visual hit order', () => {
  const candidates = resolveOrderDocumentSelectionCandidates([
    {
      childId: 'title:field-row:title_text',
      childLabel: 'Naslov dokumenta',
      elementId: 'title',
      elementLabel: 'Naslov in številka'
    },
    // Browser hit stacks normally repeat ancestors after the deepest node.
    { elementId: 'title', elementLabel: 'Naslov in številka' },
    { elementId: 'document_details', elementLabel: 'Območje dokumenta' },
    { elementId: 'intro', elementLabel: 'Uvod' }
  ]);

  assert.deepEqual(
    candidates.map(({ key, kind, label }) => ({ key, kind, label })),
    [
      {
        key: 'child:title:field-row:title_text',
        kind: 'child',
        label: 'Naslov dokumenta'
      },
      {
        key: 'element:title',
        kind: 'element',
        label: 'Naslov in številka'
      },
      {
        key: 'element:document_details',
        kind: 'element',
        label: 'Območje dokumenta'
      },
      { key: 'element:intro', kind: 'element', label: 'Uvod' }
    ]
  );
});

test('overlap candidates ignore editor chrome and normalize blank labels safely', () => {
  const candidates = resolveOrderDocumentSelectionCandidates([
    { editorChrome: true, elementId: 'toolbar', elementLabel: 'Orodna vrstica' },
    {
      elementId: 'items',
      elementLabel: '   ',
      childId: 'items:table-row:1',
      childLabel: ''
    }
  ]);

  assert.deepEqual(
    candidates.map(({ key, label }) => ({ key, label })),
    [
      {
        key: 'child:items:table-row:1',
        label: 'Pod-element items:table-row:1'
      },
      { key: 'element:items', label: 'Element items' }
    ]
  );
  assert.match(ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR, /editor-only/u);
  assert.match(ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR, /resize-handle/u);
  assert.match(ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR, /toolbar-popover/u);
});

test('DOM hit normalization retains exact child and parent nodes and derives an accessible label', () => {
  const owner = new FakeNode({ 'data-order-document-element-id': 'customer' });
  const child = new FakeNode(
    {
      'data-order-document-child-id': 'customer:field-row:email',
      'aria-label': 'Uredi vrstico E-pošta'
    },
    { element: owner }
  );
  const leaf = new FakeNode({}, { child, element: owner });

  const hits = normalizeOrderDocumentSelectionHitStack([leaf], {
    getElementLabel: (elementId) =>
      elementId === 'customer' ? 'Naročnik' : null
  });

  assert.equal(hits[0]?.childNode, child);
  assert.equal(hits[0]?.elementNode, owner);
  assert.equal(hits[0]?.childLabel, 'E-pošta');
  assert.equal(hits[0]?.elementLabel, 'Naročnik');

  const candidates = resolveOrderDocumentSelectionCandidatesFromHitStack(
    [leaf, child, owner],
    { getElementLabel: () => 'Naročnik' }
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.key),
    ['child:customer:field-row:email', 'element:customer']
  );
});

test('selection cycling is reversible, wraps, and restarts safely after the stack changes', () => {
  const candidates = resolveOrderDocumentSelectionCandidates([
    { elementId: 'title', elementLabel: 'Naslov' },
    { elementId: 'customer', elementLabel: 'Naročnik' },
    { elementId: 'intro', elementLabel: 'Uvod' }
  ]);

  assert.equal(
    cycleOrderDocumentSelectionCandidate(candidates, null)?.key,
    'element:title'
  );
  assert.equal(
    cycleOrderDocumentSelectionCandidate(candidates, 'element:title')?.key,
    'element:customer'
  );
  assert.equal(
    cycleOrderDocumentSelectionCandidate(candidates, 'element:title', -1)?.key,
    'element:intro'
  );
  assert.equal(
    cycleOrderDocumentSelectionCandidate(candidates, 'element:intro')?.key,
    'element:title'
  );
  assert.equal(
    cycleOrderDocumentSelectionCandidate(candidates, 'element:removed')?.key,
    'element:title'
  );
  assert.equal(cycleOrderDocumentSelectionCandidate([], null), null);
});
