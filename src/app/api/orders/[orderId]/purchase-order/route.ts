import { NextResponse } from 'next/server';
import { uploadBlob } from '@/lib/server/blob';
import { insertAttachment, updateOrderStatus } from '@/lib/server/orders';

const MAX_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];

export async function POST(request: Request, context: { params: { orderId: string } }) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Manjka datoteka.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Dovoljene so samo .pdf ali .jpg datoteke.' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Datoteka presega 3MB.' }, { status: 400 });
  }

  const orderId = context.params.orderId;
  const extension = file.type === 'application/pdf' ? 'pdf' : 'jpg';
  const filename = `orders/${orderId}/purchase-order.${extension}`;

  const uploaded = await uploadBlob(filename, file, file.type);

  await insertAttachment(orderId, 'school_purchase_order', uploaded.url, file.name);
  await updateOrderStatus(orderId, 'purchase_order_received');

  return NextResponse.json({ attachmentUrl: uploaded.url });
}
