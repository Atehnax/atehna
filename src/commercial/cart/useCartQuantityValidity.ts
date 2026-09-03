'use client';

import { useCallback, useState } from 'react';

export function useCartQuantityValidity() {
  const [invalidLineIds, setInvalidLineIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const onQuantityValidityChange = useCallback(
    (lineId: string, isValid: boolean) => {
      setInvalidLineIds((current) => {
        const isCurrentlyInvalid = current.has(lineId);
        if (
          (isValid && !isCurrentlyInvalid) ||
          (!isValid && isCurrentlyInvalid)
        ) {
          return current;
        }

        const next = new Set(current);
        if (isValid) {
          next.delete(lineId);
        } else {
          next.add(lineId);
        }
        return next;
      });
    },
    []
  );

  return {
    hasInvalidQuantity: invalidLineIds.size > 0,
    onQuantityValidityChange
  };
}
