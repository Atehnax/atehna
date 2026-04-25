import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  dialogActionButtonClassName,
  dialogDescriptionClassName,
  dialogFooterClassName
} from '@/shared/ui/dialog';

type UnsavedChangesDialogProps = {
  open: boolean;
  label?: string;
  itemTitle?: string | null;
  description?: ReactNode;
  isSaving?: boolean;
  saveDisabled?: boolean;
  validationMessage?: string | null;
  saveLabel?: string;
  savingLabel?: string;
  continueLabel?: string;
  discardLabel?: string;
  onSave: () => void;
  onContinueEditing: () => void;
  onDiscard: () => void;
};

const unsavedDialogActionButtonClassName = `${dialogActionButtonClassName} whitespace-nowrap !px-2.5 !text-[11px]`;

export default function UnsavedChangesDialog({
  open,
  label = 'nadaljevanjem',
  itemTitle,
  description,
  isSaving = false,
  saveDisabled = false,
  validationMessage,
  saveLabel = 'Shrani in nadaljuj',
  savingLabel = 'Shranjujem...',
  continueLabel = 'Nadaljuj urejanje',
  discardLabel = 'Zavrzi spremembe',
  onSave,
  onContinueEditing,
  onDiscard
}: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onContinueEditing();
      }}
      title="Neshranjene spremembe"
      isDismissable={false}
      panelClassName="!max-w-[32rem]"
      footer={
        <div className={`${dialogFooterClassName} flex-nowrap gap-1.5`}>
          <Button
            type="button"
            variant="restore"
            size="toolbar"
            onClick={onSave}
            disabled={saveDisabled || isSaving}
            className={unsavedDialogActionButtonClassName}
          >
            {isSaving ? savingLabel : saveLabel}
          </Button>
          <Button
            type="button"
            variant="default"
            size="toolbar"
            onClick={onContinueEditing}
            className={unsavedDialogActionButtonClassName}
          >
            {continueLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="toolbar"
            onClick={onDiscard}
            className={unsavedDialogActionButtonClassName}
          >
            {discardLabel}
          </Button>
        </div>
      }
    >
      {description ? (
        <p className={dialogDescriptionClassName}>{description}</p>
      ) : itemTitle ? (
        <p className={dialogDescriptionClassName}>
          Pred {label} <span className="font-semibold text-slate-900">{itemTitle}</span>{' '}
          shrani ali zavrzi trenutno urejanje, da se spremembe ne izgubijo.
        </p>
      ) : (
        <p className={dialogDescriptionClassName}>
          Pred {label} shrani ali zavrzi trenutno urejanje, da se spremembe ne izgubijo.
        </p>
      )}
      {validationMessage ? (
        <p className="mt-2 text-xs font-medium text-rose-600">{validationMessage}</p>
      ) : null}
    </Dialog>
  );
}
