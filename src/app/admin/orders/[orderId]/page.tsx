import Link from 'next/link';
import { query } from '@/lib/server/db';
import AdminOrderActions from '@/components/admin/AdminOrderActions';

type OrderRow = {
  id: string;
  order_number: string;
  buyer_type: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street: string;
  postal_code: string;
  city: string;
  notes: string | null;
  company_name: string | null;
  tax_id_or_vat_id: string | null;
  institution_name: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: Date;
};

type ItemRow = {
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

type DocumentRow = {
  id: string;
  document_type: string;
  document_number: string | null;
  file_url: string;
  created_at: Date;
};

type AttachmentRow = {
  id: string;
  attachment_type: string;
  original_filename: string | null;
  file_url: string;
  uploaded_at: Date;
};

const formatCurrency = (amountCents: number) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(
    amountCents / 100
  );

export default async function AdminOrderDetailPage({
  params
}: {
  params: { orderId: string };
}) {
  const orderResult = await query<OrderRow>('select * from orders where id = $1', [params.orderId]);
  const order = orderResult.rows[0];

  const itemsResult = await query<ItemRow>(
    `
      select name_snapshot, unit_price_cents, quantity, line_total_cents
      from order_items
      where order_id = $1
      order by name_snapshot
    `,
    [params.orderId]
  );

  const docsResult = await query<DocumentRow>(
    `select * from documents where order_id = $1 order by created_at desc`,
    [params.orderId]
  );

  const attachmentsResult = await query<AttachmentRow>(
    `select * from attachments where order_id = $1 order by uploaded_at desc`,
    [params.orderId]
  );

  if (!order) {
    return (
      <div className="container-base py-10">
        <p className="text-slate-600">Naročilo ne obstaja.</p>
        <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
          ← Nazaj
        </Link>
      </div>
    );
  }

  return (
    <div className="container-base py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm font-semibold text-brand-600">
            ← Nazaj na seznam
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{order.order_number}</h1>
          <p className="text-sm text-slate-600">
            Status: <span className="font-semibold text-slate-900">{order.status}</span>
          </p>
        </div>
        <AdminOrderActions orderId={order.id} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Podatki kupca</h2>
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {order.first_name} {order.last_name}
            </p>
            <p>{order.email}</p>
            {order.phone && <p>{order.phone}</p>}
            <p>
              {order.street}, {order.postal_code} {order.city}
            </p>
            {order.company_name && <p>Podjetje: {order.company_name}</p>}
            {order.tax_id_or_vat_id && <p>DDV/Davčna: {order.tax_id_or_vat_id}</p>}
            {order.institution_name && <p>Ustanova: {order.institution_name}</p>}
            {order.notes && <p className="mt-2 whitespace-pre-line">Opombe: {order.notes}</p>}
          </div>

          <h3 className="mt-6 text-lg font-semibold text-slate-900">Postavke</h3>
          <div className="mt-3 space-y-2">
            {itemsResult.rows.map((item) => (
              <div
                key={`${item.name_snapshot}-${item.unit_price_cents}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{item.name_snapshot}</span>
                <span>
                  {item.quantity} × {formatCurrency(item.unit_price_cents)} ={' '}
                  {formatCurrency(item.line_total_cents)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Vmesna vsota</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(Number(order.subtotal_cents))}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>DDV</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(Number(order.tax_cents))}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Skupaj</span>
              <span>{formatCurrency(Number(order.total_cents))}</span>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Dokumenti</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {docsResult.rows.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between">
                  <span>
                    {doc.document_type}
                    {doc.document_number ? ` (${doc.document_number})` : ''}
                  </span>
                  <a href={doc.file_url} className="font-semibold text-brand-600">
                    Prenesi
                  </a>
                </li>
              ))}
              {docsResult.rows.length === 0 && <li>Ni dokumentov.</li>}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Priloge</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {attachmentsResult.rows.map((att) => (
                <li key={att.id} className="flex items-center justify-between">
                  <span>{att.original_filename ?? att.attachment_type}</span>
                  <a href={att.file_url} className="font-semibold text-brand-600">
                    Prenesi
                  </a>
                </li>
              ))}
              {attachmentsResult.rows.length === 0 && <li>Ni prilog.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
