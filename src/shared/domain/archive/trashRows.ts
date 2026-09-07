type TrashRow = { entry: { item_type: 'order' | 'pdf'; order_id: number | null }; isChild: boolean; parentOrderId: number | null };

/** Page whole orders, retaining every document next to its parent despite global sorting. */
export function groupTrashRows<T extends TrashRow>(rows: readonly T[]): T[][] {
  const children = new Map<number, T[]>();
  for (const row of rows) {
    if (!row.isChild || row.parentOrderId === null) continue;
    children.set(row.parentOrderId, [...children.get(row.parentOrderId) ?? [], row]);
  }
  return rows.filter(row => !row.isChild).map(row => [row, ...(row.entry.item_type === 'order' && row.entry.order_id !== null ? children.get(row.entry.order_id) ?? [] : [])]);
}
