'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { AdminSearchInput } from '@/shared/ui/admin-search-input';
import { adminTableSearchIconClassName, adminTableSearchInputClassName, adminTableSearchWrapperClassName } from '@/shared/ui/admin-table';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { formatEuro } from '@/shared/domain/formatting';

export type AdminCatalogPickerChoice = { catalogVariantId: number; name: string; sku: string; unitPrice: number };
const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function AdminCatalogItemPicker<Choice extends AdminCatalogPickerChoice>({
  open, choices, onSelect, onClose, triggerRef, title = 'Dodaj artikel',
  searchLabel = 'Išči artikel', context = 'order', dialogId: providedDialogId,
  getChoiceLabel, footer
}: {
  open: boolean;
  choices: Choice[];
  onSelect: (choice: Choice) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  title?: string;
  searchLabel?: string;
  context?: 'order' | 'quote';
  dialogId?: string;
  getChoiceLabel?: (choice: Choice) => string;
  footer?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dismissRefs = useMemo(() => [dialogRef] as const, []);
  const generatedDialogId = useId();
  const titleId = useId();
  const dialogId = providedDialogId ?? generatedDialogId;
  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    setQuery('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose, triggerRef]);

  useDropdownDismiss({ open, onClose: closeAndRestoreFocus, refs: dismissRefs, returnFocusRef: triggerRef });
  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const filteredChoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('sl');
    return choices.filter(choice => !normalizedQuery ||
      choice.name.toLocaleLowerCase('sl').includes(normalizedQuery) ||
      choice.sku.toLocaleLowerCase('sl').includes(normalizedQuery));
  }, [choices, query]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = dialogRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled'));
    if (!focusable.length) { event.preventDefault(); panel.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      data-admin-order-item-picker-overlay={context === 'order' ? '' : undefined}
      data-quote-item-picker-overlay={context === 'quote' ? '' : undefined}>
      <div id={dialogId} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        tabIndex={-1} onKeyDown={handleKeyDown}
        data-admin-order-item-picker-dialog={context === 'order' ? '' : undefined}
        data-quote-item-picker-dialog={context === 'quote' ? '' : undefined}
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-[13px] font-semibold text-slate-900">{title}</h3>
          <button type="button" className="text-[12px] text-slate-500 hover:text-slate-700" onClick={closeAndRestoreFocus}>Zapri</button>
        </div>
        <div className="mt-3">
          <AdminSearchInput autoFocus value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Išči po nazivu ali šifri" aria-label={searchLabel}
            wrapperClassName={adminTableSearchWrapperClassName} inputClassName={adminTableSearchInputClassName}
            iconClassName={adminTableSearchIconClassName} />
        </div>
        <div className="mt-3 max-h-[360px] overflow-y-auto rounded-md border border-slate-200">
          {filteredChoices.map(choice => (
            <button key={choice.catalogVariantId} type="button"
              onClick={() => { onSelect(choice); closeAndRestoreFocus(); }}
              className="flex w-full items-center justify-between gap-4 border-b border-slate-200/80 px-3 py-3 text-left text-[12px] text-slate-700 transition-colors hover:bg-[color:var(--admin-table-row-hover)] last:border-b-0">
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{getChoiceLabel?.(choice) ?? choice.name}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">SKU: {choice.sku}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">{formatEuro(choice.unitPrice)}</span>
            </button>
          ))}
          {!filteredChoices.length ? <div className="px-3 py-6 text-center text-[12px] text-slate-500">Ni ujemajočih artiklov.</div> : null}
        </div>
        {footer ? <div className="mt-3 flex justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}
