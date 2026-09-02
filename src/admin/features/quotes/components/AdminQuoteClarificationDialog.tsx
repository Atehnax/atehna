'use client';

import { useId, type RefObject } from 'react';
import { Button } from '@/shared/ui/button';
import { adminPlaceholderTokenClasses } from '@/shared/ui/theme/tokens';
import {
  Dialog,
  dialogActionButtonClassName,
  dialogDescriptionClassName,
  dialogFooterClassName
} from '@/shared/ui/dialog';

export type AdminQuoteClarificationDialogStep = 'compose' | 'confirm-email';

type AdminQuoteClarificationDialogProps = {
  open: boolean;
  step: AdminQuoteClarificationDialogStep;
  draft: string;
  recipientEmail: string;
  busy: boolean;
  error: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  sendButtonRef: RefObject<HTMLButtonElement | null>;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onBack: () => void;
  onAdvance: () => void;
  onRecordOnly: () => void;
  onRecordAndSend: () => void;
};

const MAX_CLARIFICATION_LENGTH = 2_000;

const clarificationTextareaClassName =
  `min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-['Inter',system-ui,sans-serif] text-[13px] leading-5 text-slate-900 outline-none transition ${adminPlaceholderTokenClasses} focus:border-[#3e67d6] focus:ring-1 focus:ring-[#3e67d6] disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500`;

export default function AdminQuoteClarificationDialog({
  open,
  step,
  draft,
  recipientEmail,
  busy,
  error,
  textareaRef,
  sendButtonRef,
  onDraftChange,
  onCancel,
  onBack,
  onAdvance,
  onRecordOnly,
  onRecordAndSend
}: AdminQuoteClarificationDialogProps) {
  const descriptionId = useId();
  const errorId = useId();
  const trimmedDraft = draft.trim();
  const normalizedRecipientEmail = recipientEmail.trim();
  const isDraftValid =
    trimmedDraft.length > 0 && draft.length <= MAX_CLARIFICATION_LENGTH;
  const canSendEmail = isDraftValid && normalizedRecipientEmail.length > 0;
  const inlineError =
    error ??
    (draft.length > MAX_CLARIFICATION_LENGTH
      ? 'Pojasnilo je lahko dolgo največ ' +
        MAX_CLARIFICATION_LENGTH.toLocaleString('sl-SI') +
        ' znakov.'
      : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onCancel();
      }}
      title={
        step === 'compose'
          ? 'Zahteva za pojasnilo'
          : 'E-poštno obvestilo stranki'
      }
      isDismissable={step === 'compose' && !busy}
      initialFocusRef={step === 'compose' ? textareaRef : sendButtonRef}
      panelClassName="max-w-lg"
      footer={
        step === 'compose' ? (
          <div className={dialogFooterClassName}>
            <Button
              type="button"
              variant="default"
              size="toolbar"
              onClick={onCancel}
              disabled={busy}
              className={dialogActionButtonClassName}
              data-testid="quote-clarification-cancel"
            >
              Prekliči
            </Button>
            <Button
              type="button"
              variant="primary"
              size="toolbar"
              onClick={onAdvance}
              disabled={busy || !isDraftValid}
              className={dialogActionButtonClassName}
              data-testid="quote-clarification-advance"
            >
              Nadaljuj
            </Button>
          </div>
        ) : (
          <div className={dialogFooterClassName + ' flex-wrap'}>
            <Button
              type="button"
              variant="default"
              size="toolbar"
              onClick={onBack}
              disabled={busy}
              className={dialogActionButtonClassName}
              data-testid="quote-clarification-back"
            >
              Nazaj
            </Button>
            <Button
              type="button"
              variant="default"
              size="toolbar"
              onClick={onRecordOnly}
              disabled={busy || !isDraftValid}
              className={dialogActionButtonClassName}
              data-testid="quote-clarification-record-only"
            >
              {busy ? 'Beležim …' : 'Samo zabeleži'}
            </Button>
            <Button
              ref={sendButtonRef}
              type="button"
              variant="primary"
              size="toolbar"
              onClick={onRecordAndSend}
              disabled={busy || !canSendEmail}
              className={dialogActionButtonClassName}
              data-testid="quote-clarification-record-and-send"
            >
              {busy ? 'Beležim …' : 'Zabeleži z e-pošto'}
            </Button>
          </div>
        )
      }
    >
      <div data-testid="quote-clarification-dialog">
        {step === 'compose' ? (
          <>
            <p id={descriptionId} className={dialogDescriptionClassName}>
              Jasno opišite, katere podatke ali dopolnitve potrebujete od
              stranke. Zahteva bo zabeležena v dejavnosti povpraševanja.
            </p>
            <label className="mt-4 block text-[12px] font-semibold text-slate-700">
              <span>Pojasnilo *</span>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                maxLength={MAX_CLARIFICATION_LENGTH}
                disabled={busy}
                aria-describedby={[descriptionId, inlineError ? errorId : null]
                  .filter(Boolean)
                  .join(' ')}
                aria-invalid={Boolean(inlineError)}
                placeholder="Prosimo, potrdite želene dimenzije in količino artikla."
                className={clarificationTextareaClassName + ' mt-1.5'}
                data-testid="quote-clarification-textarea"
              />
            </label>
            <div className="mt-1.5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {inlineError ? (
                  <p
                    id={errorId}
                    role="alert"
                    className="text-[11px] font-medium leading-4 text-rose-600"
                  >
                    {inlineError}
                  </p>
                ) : null}
              </div>
              <p
                className="shrink-0 text-[10px] tabular-nums text-slate-500"
                aria-live="polite"
              >
                {draft.length.toLocaleString('sl-SI')} /{' '}
                {MAX_CLARIFICATION_LENGTH.toLocaleString('sl-SI')}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className={dialogDescriptionClassName}>
              Izberite, ali želite zahtevo samo zabeležiti ali zahtevati tudi
              e-poštno obvestilo stranki.
            </p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Prejemnik
              </p>
              <p className="mt-1 break-all text-[12px] font-medium text-slate-800">
                {normalizedRecipientEmail || 'E-poštni naslov ni na voljo.'}
              </p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Pojasnilo
              </p>
              <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-800">
                {trimmedDraft}
              </p>
            </div>
            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-800">
              Ob izbiri »Zabeleži z e-pošto« bo obvestilo uvrščeno v čakalno
              vrsto samo, če je dogodek »Zahteva za pojasnilo« za stranko
              omogočen v{' '}
              <a className="font-semibold underline" href="/admin/email">
                nastavitvah E-pošta
              </a>
              . Nastavljeni predlogi bo dodano zgornje pojasnilo.
            </p>
            {!normalizedRecipientEmail ? (
              <p
                role="alert"
                className="mt-2 text-[11px] font-medium leading-4 text-amber-700"
              >
                Stranka nima veljavnega e-poštnega naslova. Zahtevo lahko samo
                zabeležite.
              </p>
            ) : null}
            {inlineError ? (
              <p
                role="alert"
                className="mt-2 text-[11px] font-medium leading-4 text-rose-600"
              >
                {inlineError}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
