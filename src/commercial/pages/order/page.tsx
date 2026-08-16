import OrderPageClient from '@/commercial/order/components/OrderPageClient';
import { getGursAddressSourceMetadata } from '@/shared/server/gursAddresses';

export const metadata = {
  title: 'Naročilo'
};

export default async function OrderPage() {
  let initialGursSourceUpdatedAt: string | null = null;
  try {
    const metadata = await getGursAddressSourceMetadata();
    initialGursSourceUpdatedAt = metadata.sourceUpdatedAt;
  } catch {
    // Address search is an enhancement; checkout must remain available.
  }

  return (
    <div className="container-base site-section" data-testid="order-page">
      <div className="w-full">
        <OrderPageClient
          initialGursSourceUpdatedAt={initialGursSourceUpdatedAt}
        />
      </div>
    </div>
  );
}
