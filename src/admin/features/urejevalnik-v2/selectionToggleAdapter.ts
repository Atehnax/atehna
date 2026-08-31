import type {
  DesignerSchemaSelectionTarget,
  DesignerSelection,
  DesignerSelectedSchema
} from '@pdfme/ui';

type DesignerSelectionPort = {
  getSelection(): DesignerSelection;
  onChangeSelection(callback: (selection: DesignerSelection) => void): void;
  selectSchemas(
    targets: DesignerSchemaSelectionTarget | DesignerSchemaSelectionTarget[],
    options?: { pageIndex?: number; scroll?: boolean }
  ): void;
};

type ModifierSnapshot = {
  pageIndex: number;
  schemas: DesignerSelectedSchema[];
};

const selectionKey = (schema: DesignerSelectedSchema) =>
  `${schema.pageIndex}:${schema.schemaId}`;

export const mergeToggledSelection = (
  previous: DesignerSelectedSchema[],
  next: DesignerSelectedSchema[]
): DesignerSelectedSchema[] => {
  if (next.length !== 1) return next;

  const clicked = next[0];
  const clickedKey = selectionKey(clicked);
  const previousKeys = new Set(previous.map(selectionKey));

  if (previousKeys.has(clickedKey)) {
    return previous.filter((schema) => selectionKey(schema) !== clickedKey);
  }

  return [...previous, clicked];
};

const toSelectionTarget = (schema: DesignerSelectedSchema): DesignerSchemaSelectionTarget => ({
  pageIndex: schema.pageIndex,
  schemaId: schema.schemaId
});

export function installModifierSelectionAdapter({
  container,
  designer,
  onSelectionChange
}: {
  container: HTMLElement;
  designer: DesignerSelectionPort;
  onSelectionChange: (selection: DesignerSelection) => void;
}): () => void {
  let pending: ModifierSnapshot | null = null;
  let applying = false;
  let pendingClearFrame: number | null = null;

  const captureModifierPointer = (event: PointerEvent) => {
    if (pendingClearFrame !== null) {
      cancelAnimationFrame(pendingClearFrame);
      pendingClearFrame = null;
    }
    if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) {
      pending = null;
      return;
    }

    const current = designer.getSelection();
    pending = {
      pageIndex: current.pageIndex,
      schemas: current.schemas
    };
  };

  const expireModifierSnapshot = () => {
    const snapshot = pending;
    if (!snapshot) return;
    pendingClearFrame = requestAnimationFrame(() => {
      pendingClearFrame = null;
      if (pending === snapshot) pending = null;
    });
  };

  container.addEventListener('pointerdown', captureModifierPointer, true);
  window.addEventListener('pointerup', expireModifierSnapshot, true);
  window.addEventListener('pointercancel', expireModifierSnapshot, true);
  designer.onChangeSelection((selection) => {
    if (applying) {
      applying = false;
      onSelectionChange(selection);
      return;
    }

    const snapshot = pending;
    pending = null;
    if (pendingClearFrame !== null) {
      cancelAnimationFrame(pendingClearFrame);
      pendingClearFrame = null;
    }

    if (!snapshot || selection.schemas.length !== 1) {
      onSelectionChange(selection);
      return;
    }

    const merged = mergeToggledSelection(snapshot.schemas, selection.schemas);
    const pageIndex = selection.schemas[0]?.pageIndex ?? snapshot.pageIndex;
    applying = true;
    designer.selectSchemas(merged.map(toSelectionTarget), { pageIndex, scroll: false });
  });

  return () => {
    container.removeEventListener('pointerdown', captureModifierPointer, true);
    window.removeEventListener('pointerup', expireModifierSnapshot, true);
    window.removeEventListener('pointercancel', expireModifierSnapshot, true);
    if (pendingClearFrame !== null) {
      cancelAnimationFrame(pendingClearFrame);
    }
  };
}
