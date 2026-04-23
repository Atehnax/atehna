import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { adminTablePrimaryButtonClassName } from '@/shared/ui/admin-table';
import {
  Dialog,
  dialogActionButtonClassName,
  dialogDescriptionClassName,
  dialogFooterClassName
} from '@/shared/ui/dialog';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
  panelClassName?: string;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potrdi',
  cancelLabel = 'Prekliči',
  isDanger = false,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  children,
  panelClassName
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      title={title}
      isDismissable={false}
      panelClassName={panelClassName}
      footer={
        <div className={dialogFooterClassName}>
          <Button
            type="button"
            variant="default"
            size="toolbar"
            onClick={onCancel}
            className={dialogActionButtonClassName}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDanger ? 'danger' : 'primary'}
            size="toolbar"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={isDanger ? dialogActionButtonClassName : `${adminTablePrimaryButtonClassName} !h-8 !rounded-lg !px-3`}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? <p className={dialogDescriptionClassName}>{description}</p> : null}
      {children}
    </Dialog>
  );
}
