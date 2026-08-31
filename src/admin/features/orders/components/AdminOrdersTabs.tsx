'use client';

import { useRouter } from 'next/navigation';
import EuiTabs, { type EuiTabItem } from '@/shared/ui/eui-tabs';

type AdminOrdersView = 'orders' | 'quotes';

function notificationCountLabel(
  count: number,
  forms: { one: string; two: string; few: string; many: string }
) {
  const normalizedCount = Math.max(0, Math.trunc(count));
  const remainder = normalizedCount % 100;
  const form = remainder === 1
    ? forms.one
    : remainder === 2
      ? forms.two
      : remainder === 3 || remainder === 4
        ? forms.few
        : forms.many;
  return `${normalizedCount} ${form}`;
}

export default function AdminOrdersTabs({
  activeView,
  quoteAdminEnabled,
  attentionOrderCount,
  newQuoteCount
}: {
  activeView: AdminOrdersView;
  quoteAdminEnabled: boolean;
  attentionOrderCount: number;
  newQuoteCount: number;
}) {
  const router = useRouter();
  const tabs: EuiTabItem[] = [
    {
      value: 'orders',
      label: 'Naročila',
      notification: {
        count: attentionOrderCount,
        label: notificationCountLabel(attentionOrderCount, {
          one: 'naročilo za obravnavo',
          two: 'naročili za obravnavo',
          few: 'naročila za obravnavo',
          many: 'naročil za obravnavo'
        })
      },
      panelId: 'admin-orders-panel-orders'
    },
    ...(quoteAdminEnabled
      ? [{
          value: 'quotes',
          label: 'Povpraševanja in ponudbe',
          notification: {
            count: newQuoteCount,
            label: notificationCountLabel(newQuoteCount, {
              one: 'novo povpraševanje',
              two: 'novi povpraševanji',
              few: 'nova povpraševanja',
              many: 'novih povpraševanj'
            })
          },
          panelId: 'admin-orders-panel-quotes'
        } satisfies EuiTabItem]
      : [])
  ];

  return (
    <EuiTabs
      value={activeView}
      onChange={(nextView) => {
        router.push(nextView === 'quotes' ? '/admin/orders?view=quotes' : '/admin/orders');
      }}
      tabs={tabs}
      ariaLabel="Naročila in ponudbe"
      idPrefix="admin-orders"
    />
  );
}

export type { AdminOrdersView };
