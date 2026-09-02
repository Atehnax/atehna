'use client';

import type { RefObject } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  dialogActionButtonClassName,
  dialogDescriptionClassName,
  dialogFooterClassName
} from '@/shared/ui/dialog';

export type AdminQuoteIssueDialogProps = {
  open: boolean;
  offerReference: string;
  recipientEmail: string;
  total: string;
  busy: boolean;
  error: string | null;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
};

const summaryLabelClassName =
  'text-[10px] font-semibold uppercase tracking-wide text-slate-500';
const summaryValueClassName =
  'mt-1 min-w-0 break-words text-[12px] font-medium text-slate-800';

export default function AdminQuoteIssueDialog({
  open,
  offerReference,
  recipientEmail,
  total,
  busy,
  error,
  cancelButtonRef,
  confirmButtonRef,
  onCancel,
  onConfirm
}: AdminQuoteIssueDialogProps) {
  const normalizedReference = offerReference.trim() || '—';
  const normalizedRecipientEmail = recipientEmail.trim() || '—';
  const normalizedTotal = total.trim() || '—';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onCancel();
      }}
      title="Izdaja ponudbe"
      isDismissable={!busy}
      initialFocusRef={cancelButtonRef}
      panelClassName="max-w-lg"
      footer={
        <div className={dialogFooterClassName}>
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="default"
            size="toolbar"
            onClick={onCancel}
            disabled={busy}
            className={dialogActionButtonClassName}
            data-testid="quote-issue-cancel"
          >
            Prekliči
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant="primary"
            size="toolbar"
            onClick={onConfirm}
            disabled={busy}
            className={dialogActionButtonClassName}
            data-testid="quote-issue-confirm"
          >
            {busy ? 'Izdajam …' : 'Izdaj ponudbo'}
          </Button>
        </div>
      }
    >
      <div data-testid="quote-issue-dialog">
        <p className={dialogDescriptionClassName}>
          Pred potrditvijo preverite ponudbo, prejemnika in končni znesek.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className={summaryLabelClassName}>Ponudba</dt>
            <dd
              className={summaryValueClassName}
              data-testid="quote-issue-reference"
            >
              {normalizedReference}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className={summaryLabelClassName}>Skupaj z DDV</dt>
            <dd
              className={summaryValueClassName + ' tabular-nums'}
              data-testid="quote-issue-total"
            >
              {normalizedTotal}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className={summaryLabelClassName}>Prejemnik</dt>
            <dd
              className={summaryValueClassName + ' break-all'}
              data-testid="quote-issue-recipient"
            >
              {normalizedRecipientEmail}
            </dd>
          </div>
        </dl>

        <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-800">
          Ob potrditvi bo trenutna različica ponudbe shranjena in zamrznjena.
          Nadaljnje spremembe bodo zahtevale novo različico. E-pošta stranki bo
          uvrščena v čakalno vrsto samo, če je dogodek »Ponudba izdana« zanjo
          omogočen v{' '}
          <a className="font-semibold underline" href="/admin/email">
            nastavitvah E-pošta
          </a>
          .
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-2 text-[11px] font-medium leading-4 text-rose-600"
            data-testid="quote-issue-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
