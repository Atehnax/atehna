'use client';

import { useCallback, useState } from 'react';
import {
  parseCustomerEmailConfirmationRequired,
  type CustomerEmailConfirmationDetails
} from '@/admin/features/email/customerEmailConfirmation';

type ConfirmationCallback = (
  confirmationToken: string
) => void | Promise<void>;

type PendingCustomerEmailConfirmation = {
  details: CustomerEmailConfirmationDetails;
  onConfirm: ConfirmationCallback;
};

export function useCustomerEmailConfirmation() {
  const [pending, setPending] =
    useState<PendingCustomerEmailConfirmation | null>(null);

  const requestConfirmation = useCallback((
    details: CustomerEmailConfirmationDetails,
    onConfirm: ConfirmationCallback
  ) => {
    setPending({ details, onConfirm });
  }, []);

  const handleConfirmationRequired = useCallback((
    response: Response,
    payload: unknown,
    onConfirm: ConfirmationCallback
  ): boolean => {
    if (response.status !== 428) return false;
    const details = parseCustomerEmailConfirmationRequired(payload);
    if (!details) return false;
    setPending({ details, onConfirm });
    return true;
  }, []);

  const cancelConfirmation = useCallback(() => {
    setPending(null);
  }, []);

  const confirm = useCallback(() => {
    const callback = pending?.onConfirm;
    setPending(null);
    if (callback && pending) void callback(pending.details.confirmationToken);
  }, [pending]);

  return {
    confirmation: pending?.details ?? null,
    requestConfirmation,
    handleConfirmationRequired,
    cancelConfirmation,
    confirm
  };
}
