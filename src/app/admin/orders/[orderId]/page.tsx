import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminOrderActions from '@/components/admin/AdminOrderActions';
import {
  fetchOrderAttachments,
  fetchOrderById,
  fetchOrderDocuments,
  fetchOrderItems
} from '@/lib/server/orders';

export const metadata = {
  title: 'Podrobnosti naročila'
};

export default async function AdminOrderDetailPage({
  params
}: {
  params: { orderId: string };
}) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    notFound();
  }

  const order = await fetchOrderById(orderId);
  if (!order) {
    notFound();
  }

  const [items, documents, attachments] = await Promise.all([
    fetchOrderItems(orderId),
    fetchOrderDocuments(orderId),
    fetchOrderAttachments(orderId)
  ]);

  return (
    <div className="container-base py-12">
      <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
        ← Nazaj na seznam
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              {order.order_number}
            </h1>
            <p className="mt-2 text-sm text-slate-600">Status: {order.status}</p>

            <div className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-400">Naročnik</p>
                <p className="font-semibold text-slate-900">
                  {order.organization_name || order.contact_name}
                </p>
                <p>{order.customer_type}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Kontakt</p>
                <p>{order.contact_name}</p>
                <p>{order.email}</p>
                {order.phone && <p>{order.phone}</p>}
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Naslov</p>
                <p>{order.delivery_address || 'Ni podan.'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Sklic</p>
                <p>{order.reference || 'Ni podan.'}</p>
              </div>
              {order.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs uppercase text-slate-400">Opombe</p>
                  <p>{order.notes}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Postavke</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"
                >
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-slate-500">SKU: {item.sku}</p>
                  <p className="text-slate-500">
                    Količina: {item.quantity} {item.unit ?? ''}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Dokumenti</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {documents.length === 0 ? (
                <li>Ni shranjenih dokumentov.</li>
              ) : (
                documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.blob_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {doc.type.toUpperCase()}
                    </a>{' '}
                    <span className="text-xs text-slate-400">({doc.filename})</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Priponke</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {attachments.length === 0 ? (
                <li>Ni naloženih priponk.</li>
              ) : (
                attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={attachment.blob_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {attachment.type.replace('_', ' ').toUpperCase()}
                    </a>{' '}
                    <span className="text-xs text-slate-400">({attachment.filename})</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        <AdminOrderActions orderId={orderId} status={order.status} documents={documents} />
      </div>
    </div>
  );
}
