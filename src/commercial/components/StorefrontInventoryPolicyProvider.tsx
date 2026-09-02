'use client';

import { createContext, useContext, type ReactNode } from 'react';

const StockEnforcementContext = createContext(true);

export function StorefrontInventoryPolicyProvider({
  stockEnforcementEnabled,
  children
}: {
  stockEnforcementEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <StockEnforcementContext.Provider value={stockEnforcementEnabled}>
      {children}
    </StockEnforcementContext.Provider>
  );
}

/**
 * Defaults to the safe, historical behavior for isolated previews and tests
 * that render a commercial component outside the public root layout.
 */
export function useStockEnforcementEnabled() {
  return useContext(StockEnforcementContext);
}
