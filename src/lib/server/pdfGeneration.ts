import crypto from 'node:crypto';
import { getPool } from '@/lib/server/db';

type PdfTypeKey = 'order_summary' | 'purchase_order' | 'dobavnica' | 'predracun' | 'invoice';

const DOC_CODE_BY_TYPE: Record<PdfTypeKey, string> = {
  order_summary: 'PN',
  purchase_order: 'N',
  dobavnica: 'D',
  predracun: 'P',
  invoice: 'R'
};

const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const buildSuffix = () => crypto.randomBytes(18).toString('base64url');

export const buildGeneratedPdfFilename = (options: {
  type: PdfTypeKey;
  orderIdentifier: string | number;
  version: number;
  now?: Date;
}) => {
  const orderPart = String(options.orderIdentifier).trim() || 'UNKNOWN';
  const code = DOC_CODE_BY_TYPE[options.type];
  return `${code}-${orderPart}-${options.version}-${toDateKey(options.now)}-${buildSuffix()}.pdf`;
};

const isMissingColumnError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42703');

export async function getNextPdfVersion(orderId: number, type: PdfTypeKey): Promise<number> {
  const pool = await getPool();

  try {
    const result = await pool.query(
      'select count(*)::int as total from order_documents where order_id = $1 and type = $2 and deleted_at is null',
      [orderId, type]
    );
    return Number(result.rows[0]?.total ?? 0) + 1;
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    const fallback = await pool.query(
      'select count(*)::int as total from order_documents where order_id = $1 and type = $2',
      [orderId, type]
    );
    return Number(fallback.rows[0]?.total ?? 0) + 1;
  }
}
