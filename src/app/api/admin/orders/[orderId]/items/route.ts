import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';

type IncomingItem = {
  id?: number;
  sku: string;
  name: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
};

const TAX_RATE = 0.22;

const roundAmount = (value: number) => Math.round(value * 100) / 100;

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const itemsRaw = Array.isArray(body?.items) ? body.items : null;
    const shippingRaw = normalizeNumber(body?.shipping ?? 0);
    const shipping = Number.isFinite(shippingRaw) ? Math.max(0, roundAmount(shippingRaw)) : 0;

    if (!itemsRaw || itemsRaw.length === 0) {
      return NextResponse.json({ message: 'Naročilo mora vsebovati vsaj eno postavko.' }, { status: 400 });
    }

    const normalizedItems: IncomingItem[] = itemsRaw.map((rawItem: Record<string, unknown>) => {
      const quantity = normalizeNumber(rawItem?.quantity);
      const unitPrice = normalizeNumber(rawItem?.unitPrice);
      const discountPercentage = Math.max(0, normalizeNumber(rawItem?.discountPercentage ?? 0));

      const safeItem: IncomingItem = {
        id: typeof rawItem?.id === 'number' ? rawItem.id : undefined,
        sku: String(rawItem?.sku ?? '').trim(),
        name: String(rawItem?.name ?? '').trim(),
        unit: typeof rawItem?.unit === 'string' && rawItem.unit.trim() ? rawItem.unit.trim() : null,
        quantity,
        unitPrice,
        discountPercentage
      };

      return safeItem;
    });

    for (const item of normalizedItems) {
      if (!item.sku || !item.name) {
        return NextResponse.json({ message: 'Manjkajo podatki postavke (SKU/ime).' }, { status: 400 });
      }
      if (!Number.isFinite(item.quantity) || item.quantity < 1) {
        return NextResponse.json({ message: 'Količina mora biti vsaj 1.' }, { status: 400 });
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        return NextResponse.json({ message: 'Cena postavke mora biti veljavna.' }, { status: 400 });
      }
      const discountPercentage = item.discountPercentage ?? 0;
      if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
        return NextResponse.json({ message: 'Popust mora biti med 0 in 100 %.' }, { status: 400 });
      }

      const lineBase = item.quantity * item.unitPrice;
      const lineDiscount = (lineBase * discountPercentage) / 100;
      if (lineDiscount > lineBase) {
        return NextResponse.json({ message: 'Popust ne sme presegati vrednosti postavke.' }, { status: 400 });
      }
    }

    const subtotal = roundAmount(
      normalizedItems.reduce((sum, item) => {
        const lineBase = item.quantity * item.unitPrice;
        const lineDiscount = (lineBase * (item.discountPercentage ?? 0)) / 100;
        return sum + (lineBase - lineDiscount);
      }, 0)
    );
    const tax = roundAmount(subtotal * TAX_RATE);
    const total = roundAmount(subtotal + tax + shipping);

    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      for (const item of normalizedItems) {
        const lineBase = item.quantity * item.unitPrice;
        const lineTotal = roundAmount(lineBase - (lineBase * (item.discountPercentage ?? 0)) / 100);

        await client.query(
          `
          INSERT INTO order_items (order_id, sku, name, unit, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            orderId,
            item.sku,
            item.name,
            item.unit,
            item.quantity,
            roundAmount(item.unitPrice),
            lineTotal
          ]
        );
      }

      const hasShippingColumnResult = await client.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping'
        LIMIT 1
        `
      );
      const hasShippingColumn = (hasShippingColumnResult.rowCount ?? 0) > 0;

      if (hasShippingColumn) {
        await client.query(
          'UPDATE orders SET subtotal = $1, tax = $2, shipping = $3, total = $4 WHERE id = $5',
          [subtotal, tax, shipping, total, orderId]
        );
      } else {
        await client.query(
          'UPDATE orders SET subtotal = $1, tax = $2, total = $3 WHERE id = $4',
          [subtotal, tax, total, orderId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, totals: { subtotal, tax, shipping, total } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
