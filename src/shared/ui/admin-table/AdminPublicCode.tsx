'use client';

import { useEffect, useRef } from 'react';
import { abbreviateCommercePublicCode } from '@/shared/domain/commercePublicCode';
import { useToast } from '@/shared/ui/toast';

type AdminPublicCodeProps = {
  code: string;
  label: string;
  testId: string;
};

export default function AdminPublicCode({ code, label, testId }: AdminPublicCodeProps) {
  const controlRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const abbreviated = abbreviateCommercePublicCode(code);

  useEffect(() => {
    const copySelection = (event: ClipboardEvent) => {
      const control = controlRef.current;
      const selection = document.getSelection();
      const activeElement = document.activeElement;
      // Form controls may keep a stale document selection while their own text
      // is selected. Never replace normal copying from an editable control.
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) return;
      if (
        event.defaultPrevented || !event.clipboardData || !control ||
        !selection || selection.isCollapsed || selection.rangeCount !== 1 ||
        selection.toString().trim() !== abbreviated ||
        !selection.getRangeAt(0).intersectsNode(control)
      ) return;

      event.clipboardData.setData('text/plain', code);
      event.preventDefault();
    };

    // Copy events can target the previously focused element rather than the
    // selected button. Only replace a selection of this entire displayed code.
    document.addEventListener('copy', copySelection);
    return () => document.removeEventListener('copy', copySelection);
  }, [abbreviated, code]);

  return (
    <button
      ref={controlRef}
      type="button"
      data-testid={testId}
      data-no-row-nav
      className="inline-block max-w-full cursor-copy select-text whitespace-nowrap rounded-sm text-[10px] font-medium leading-4 text-slate-500 transition-colors hover:text-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e67d6]/30"
      aria-label={`Kopiraj celotno kodo ${label}: ${code}`}
      title={code}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          toast.success('Koda je kopirana.');
        } catch {
          toast.error('Kode ni bilo mogoče kopirati.');
        }
      }}
    >
      {abbreviated}
    </button>
  );
}
