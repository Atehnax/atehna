import CartPageClient from '@/commercial/features/cart/CartPageClient';

export const metadata = {
  title: 'Košarica'
};

export default function CartPage() {
  return (
    <div className="container-base site-section">
      <CartPageClient />
    </div>
  );
}

