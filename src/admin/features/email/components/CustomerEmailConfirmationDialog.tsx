'use client';

import type { CustomerEmailConfirmationDetails } from '@/admin/features/email/customerEmailConfirmation';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

type CustomerEmailConfirmationDialogProps = {
  confirmation: CustomerEmailConfirmationDetails | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
};

const summaryLabelClassName =
  'text-[10px] font-semibold uppercase tracking-wide text-slate-500';
const summaryValueClassName =
  'mt-1 min-w-0 break-words text-[12px] font-medium text-slate-800';

export default function CustomerEmailConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
  confirmDisabled = false
}: CustomerEmailConfirmationDialogProps) {
  const actionLabel =
    confirmation?.actionLabel ||
    confirmation?.action ||
    confirmation?.eventLabel ||
    'Nadaljevanje dejanja';

  return (
    <ConfirmDialog
      open={confirmation !== null}
      title="Pošljem e-pošto stranki?"
      description="Pred nadaljevanjem preverite dejanje in prejemnika."
      confirmLabel="Potrdi in nadaljuj"
      cancelLabel="Prekliči"
      confirmDisabled={confirmDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
      panelClassName="max-h-[calc(100dvh-3rem)] max-w-lg overflow-y-auto"
    >
      {confirmation ? (
        <dl
          className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
          data-testid="customer-email-confirmation-summary"
        >
          <div className="min-w-0">
            <dt className={summaryLabelClassName}>Dejanje</dt>
            <dd className={summaryValueClassName}>{actionLabel}</dd>
          </div>
          {confirmation.deliveries.map((delivery, index) => (
            <div
              key={`${delivery.scope}:${delivery.entityId}:${delivery.eventType}:${delivery.recipientEmail}`}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <dt className={summaryLabelClassName}>
                {confirmation.deliveries.length > 1
                  ? `Obvestilo ${index + 1}`
                  : 'Obvestilo'}
              </dt>
              <dd className={summaryValueClassName}>
                {delivery.eventLabel || delivery.eventType}
              </dd>
              <dt className={summaryLabelClassName + ' mt-2'}>Prejemnik</dt>
              <dd className={summaryValueClassName + ' break-all'}>
                {delivery.recipientEmail}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </ConfirmDialog>
  );
}
