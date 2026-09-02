'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSwitch } from '@/shared/ui/admin-switch';
import { useToast } from '@/shared/ui/toast';

type InventoryPolicyResponse = {
  config?: {
    stockEnforcementEnabled?: boolean;
  };
  message?: string;
  errors?: string[];
};

async function readInventoryPolicyResponse(response: Response): Promise<InventoryPolicyResponse> {
  try {
    return (await response.json()) as InventoryPolicyResponse;
  } catch {
    return {};
  }
}

export default function AdminInventoryPolicyControl({
  initialStockEnforcementEnabled
}: {
  initialStockEnforcementEnabled: boolean;
}) {
  const router = useRouter();
  const [stockEnforcementEnabled, setStockEnforcementEnabled] = useState(initialStockEnforcementEnabled);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const updateStockEnforcement = async (nextEnabled: boolean) => {
    if (saving || nextEnabled === stockEnforcementEnabled) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/inventory-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { stockEnforcementEnabled: nextEnabled }
        })
      });
      const payload = await readInventoryPolicyResponse(response);
      if (!response.ok || typeof payload.config?.stockEnforcementEnabled !== 'boolean') {
        throw new Error(payload.errors?.[0] || payload.message || 'Nastavitve zaloge ni bilo mogoče shraniti.');
      }

      setStockEnforcementEnabled(payload.config.stockEnforcementEnabled);
      router.refresh();
      toast.success(
        payload.config.stockEnforcementEnabled
          ? 'Omejevanje naročil glede na zalogo je vključeno.'
          : 'Zaloga je informativna ter se pri novih naročilih ne rezervira ali zmanjšuje.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nastavitve zaloge ni bilo mogoče shraniti.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
      aria-labelledby="inventory-policy-title"
      data-testid="admin-inventory-policy-control"
    >
      <div className="min-w-0">
        <h2 id="inventory-policy-title" className="text-sm font-semibold text-slate-900">
          Zaloga
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          Določa, ali se zaloga rezervira, zmanjšuje in uporablja kot omejitev pri naročanju.
        </p>
      </div>
      <AdminSwitch
        checked={stockEnforcementEnabled}
        disabled={saving}
        ariaLabel={
          stockEnforcementEnabled
            ? 'Izklopi omejevanje naročil glede na zalogo'
            : 'Vključi omejevanje naročil glede na zalogo'
        }
        onChange={(enabled) => {
          void updateStockEnforcement(enabled);
        }}
      />
    </section>
  );
}
