export type OrderDocumentSelectionCandidateKey =
  | `child:${string}`
  | `element:${string}`;

export type OrderDocumentSelectionCandidateKind = 'child' | 'element';

export type OrderDocumentSelectionHit<TNode = unknown> = Readonly<{
  elementId?: string | null;
  elementLabel?: string | null;
  elementNode?: TNode;
  childId?: string | null;
  childLabel?: string | null;
  childNode?: TNode;
  editorChrome?: boolean;
}>;

export type OrderDocumentSelectionCandidate<TNode = unknown> = Readonly<{
  key: OrderDocumentSelectionCandidateKey;
  kind: OrderDocumentSelectionCandidateKind;
  elementId: string;
  childId?: string;
  label: string;
  node?: TNode;
}>;

export type OrderDocumentSelectionDomNode = {
  getAttribute(name: string): string | null;
  closest(selector: string): OrderDocumentSelectionDomNode | null;
};

export type OrderDocumentSelectionHitStackOptions<
  TNode extends OrderDocumentSelectionDomNode
> = Readonly<{
  getElementLabel?: (elementId: string, node: TNode) => string | null | undefined;
  getChildLabel?: (
    childId: string,
    elementId: string,
    node: TNode
  ) => string | null | undefined;
  chromeSelector?: string;
}>;

/**
 * Editor-only layers must never appear as selectable document content. Consumers
 * can add `data-order-document-selection-chrome` to any future canvas overlay.
 */
export const ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR = [
  '[data-order-document-selection-chrome]',
  '[data-order-document-editor-only]',
  '[data-order-document-toolbar-popover]',
  '[data-testid="order-document-element-inspector"]',
  '[data-order-document-resize-handle]'
].join(', ');

const nonEmpty = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized || undefined;
};

const childFallbackLabel = (childId: string) => `Pod-element ${childId}`;
const elementFallbackLabel = (elementId: string) => `Element ${elementId}`;

/**
 * Builds a top-to-bottom selection list from a normalized browser hit stack.
 * A child and its owning element intentionally remain separate candidates;
 * only repeated occurrences of the exact same candidate key are removed.
 */
export function resolveOrderDocumentSelectionCandidates<TNode = unknown>(
  hits: ReadonlyArray<OrderDocumentSelectionHit<TNode>>
): ReadonlyArray<OrderDocumentSelectionCandidate<TNode>> {
  const candidates: Array<OrderDocumentSelectionCandidate<TNode>> = [];
  const seen = new Set<OrderDocumentSelectionCandidateKey>();

  const append = (candidate: OrderDocumentSelectionCandidate<TNode>) => {
    if (seen.has(candidate.key)) return;
    seen.add(candidate.key);
    candidates.push(candidate);
  };

  for (const hit of hits) {
    if (hit.editorChrome) continue;

    const elementId = nonEmpty(hit.elementId);
    const childId = nonEmpty(hit.childId);

    if (elementId && childId) {
      const key: OrderDocumentSelectionCandidateKey = `child:${childId}`;
      append({
        key,
        kind: 'child',
        elementId,
        childId,
        label: nonEmpty(hit.childLabel) ?? childFallbackLabel(childId),
        node: hit.childNode
      });
    }

    if (elementId) {
      const key: OrderDocumentSelectionCandidateKey = `element:${elementId}`;
      append({
        key,
        kind: 'element',
        elementId,
        label: nonEmpty(hit.elementLabel) ?? elementFallbackLabel(elementId),
        node: hit.elementNode
      });
    }
  }

  return candidates;
}

const labelFromAria = (node: OrderDocumentSelectionDomNode) => {
  const label = nonEmpty(node.getAttribute('aria-label'));
  return label?.replace(/^Uredi(?:\s+vrstico)?\s+/iu, '').trim() || undefined;
};

/** Converts `document.elementsFromPoint()` output into normalized hit records. */
export function normalizeOrderDocumentSelectionHitStack<
  TNode extends OrderDocumentSelectionDomNode
>(
  hitStack: ReadonlyArray<TNode>,
  options: OrderDocumentSelectionHitStackOptions<TNode> = {}
): ReadonlyArray<OrderDocumentSelectionHit<TNode>> {
  const chromeSelector = options.chromeSelector
    ?? ORDER_DOCUMENT_SELECTION_CHROME_SELECTOR;

  return hitStack.map((hit): OrderDocumentSelectionHit<TNode> => {
    if (hit.closest(chromeSelector)) return { editorChrome: true };

    const childNode = hit.closest('[data-order-document-child-id]') as TNode | null;
    const elementNode = (childNode ?? hit).closest(
      '[data-order-document-element-id]'
    ) as TNode | null;
    const childId = nonEmpty(
      childNode?.getAttribute('data-order-document-child-id')
    );
    const elementId = nonEmpty(
      elementNode?.getAttribute('data-order-document-element-id')
    );

    return {
      childId,
      childNode: childNode ?? undefined,
      childLabel: childId && elementId && childNode
        ? options.getChildLabel?.(childId, elementId, childNode)
          ?? labelFromAria(childNode)
        : undefined,
      elementId,
      elementNode: elementNode ?? undefined,
      elementLabel: elementId && elementNode
        ? options.getElementLabel?.(elementId, elementNode)
        : undefined
    };
  });
}

/** Convenience wrapper for DOM hit testing while preserving exact action nodes. */
export function resolveOrderDocumentSelectionCandidatesFromHitStack<
  TNode extends OrderDocumentSelectionDomNode
>(
  hitStack: ReadonlyArray<TNode>,
  options: OrderDocumentSelectionHitStackOptions<TNode> = {}
) {
  return resolveOrderDocumentSelectionCandidates(
    normalizeOrderDocumentSelectionHitStack(hitStack, options)
  );
}

/**
 * Moves through a changing overlap stack by stable candidate key. Missing keys
 * restart at the visual front (or back when cycling backwards).
 */
export function cycleOrderDocumentSelectionCandidate<TNode = unknown>(
  candidates: ReadonlyArray<OrderDocumentSelectionCandidate<TNode>>,
  currentKey: OrderDocumentSelectionCandidateKey | null | undefined,
  direction: 1 | -1 = 1
): OrderDocumentSelectionCandidate<TNode> | null {
  if (candidates.length === 0) return null;

  const currentIndex = currentKey
    ? candidates.findIndex((candidate) => candidate.key === currentKey)
    : -1;
  if (currentIndex < 0) {
    return direction === -1
      ? candidates[candidates.length - 1]
      : candidates[0];
  }

  const nextIndex = (
    currentIndex + direction + candidates.length
  ) % candidates.length;
  return candidates[nextIndex];
}
