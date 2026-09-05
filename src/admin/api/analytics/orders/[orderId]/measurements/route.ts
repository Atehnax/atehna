import { NextResponse } from 'next/server';
import {
  ANALYTICS_MEASUREMENT_COLUMNS,
  AnalyticsMeasurementValidationError,
  parseAnalyticsMeasurementMutation
} from '@/shared/domain/analytics/measurements';
import { getPool, isDatabaseUnavailableError } from '@/shared/server/db';
import { getAuditActor, insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const selection = [
  'id', 'order_number', 'analytics_measurement_revision', 'analytics_measured_at',
  'analytics_measured_by', 'is_draft', 'deleted_at', ...Object.values(ANALYTICS_MEASUREMENT_COLUMNS)
].join(', ');
type Context = { params: Promise<{ orderId: string }> };
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

function present(row: Record<string, unknown>) {
  return {
    orderId: String(row.id),
    orderNumber: String(row.order_number),
    revision: Number(row.analytics_measurement_revision),
    measuredAt: row.analytics_measured_at,
    measuredBy: row.analytics_measured_by,
    fields: Object.fromEntries(Object.entries(ANALYTICS_MEASUREMENT_COLUMNS).map(([field, column]) => [field, row[column] ?? null]))
  };
}

export async function GET(request: Request, context: Context) {
  const actor = await getAuditActor(request);
  if (!actor.actor_id?.startsWith('admin:')) return response({ message: 'Za dostop je potrebna prijava.' }, 401);
  const { orderId } = await context.params;
  if (!/^[1-9]\d*$/.test(orderId)) return response({ message: 'Neveljaven ID naročila.' }, 400);
  try {
    const pool = await getPool();
    const current = await pool.query(`select ${selection} from orders where id = $1 and deleted_at is null`, [orderId]);
    if (!current.rows[0]) return response({ message: 'Naročilo ne obstaja.' }, 404);
    const history = await pool.query(
      'select revision, changed_at, actor_id, reason, before_json, after_json from order_analytics_change_log where order_id = $1 order by revision desc limit 20',
      [orderId]
    );
    return response({ ...present(current.rows[0]), history: history.rows });
  } catch (error) {
    return response({ message: 'Meritve niso dosegljive. Preverite namestitev podatkovne sheme.' }, isDatabaseUnavailableError(error) ? 503 : 500);
  }
}

export async function POST(request: Request, context: Context) {
  const actor = await getAuditActor(request);
  if (!actor.actor_id?.startsWith('admin:')) return response({ message: 'Za dostop je potrebna prijava.' }, 401);
  const { orderId } = await context.params;
  if (!/^[1-9]\d*$/.test(orderId)) return response({ message: 'Neveljaven ID naročila.' }, 400);
  const body = await readRequiredJsonRecord(request);
  if (!body.ok) return body.response;
  try {
    const mutation = parseAnalyticsMeasurementMutation(body.body);
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(`select ${selection} from orders where id = $1 for update`, [orderId]);
      const previous = result.rows[0];
      if (!previous || previous.deleted_at) {
        await client.query('rollback');
        return response({ message: 'Naročilo ne obstaja.' }, 404);
      }
      if (previous.is_draft) {
        await client.query('rollback');
        return response({ message: 'Meritve se zapisujejo za oddana naročila.' }, 409);
      }
      if (Number(previous.analytics_measurement_revision) !== mutation.expectedRevision) {
        await client.query('rollback');
        return response({ message: 'Meritve je medtem spremenil drug skrbnik. Ponovno jih naložite.', current: present(previous) }, 409);
      }
      const fields = mutation.fields;
      if (fields.customerDirectoryProfileId) {
        const linked = await client.query('select id from customer_directory_profiles where id = $1 and archived_at is null for share', [fields.customerDirectoryProfileId]);
        if (!linked.rowCount) throw new AnalyticsMeasurementValidationError('Izbrani trajni zapis stranke ne obstaja. Izpeljani naslovni ključi niso potrjena identiteta.');
      }
      if (fields.schoolDirectoryRowId) {
        const linked = await client.query('select id from school_directory_rows where id = $1 for share', [fields.schoolDirectoryRowId]);
        if (!linked.rowCount) throw new AnalyticsMeasurementValidationError('Izbrana šola oziroma enota ne obstaja.');
      }
      const nextRefund = Object.hasOwn(fields, 'merchandiseRefundNet') ? fields.merchandiseRefundNet : previous.merchandise_refund_net;
      const complete = fields.refundHistoryComplete ?? previous.refund_history_complete;
      if (complete && nextRefund === null) throw new AnalyticsMeasurementValidationError('Potrjena evidenca vračil zahteva točen neto znesek, tudi kadar je 0.');
      const values: unknown[] = [orderId];
      const assignments = Object.entries(fields).map(([field, value]) => {
        values.push(value);
        const column = ANALYTICS_MEASUREMENT_COLUMNS[field as keyof typeof ANALYTICS_MEASUREMENT_COLUMNS];
        return `${column} = $${values.length}`;
      });
      values.push(actor.actor_id);
      assignments.push(`analytics_measured_by = $${values.length}`, 'analytics_measured_at = now()', 'analytics_measurement_revision = analytics_measurement_revision + 1');
      const updated = await client.query(`update orders set ${assignments.join(', ')} where id = $1 returning ${selection}`, values);
      const next = updated.rows[0];
      await client.query(
        'insert into order_analytics_change_log (order_id, revision, actor_id, reason, before_json, after_json) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)',
        [orderId, next.analytics_measurement_revision, actor.actor_id, mutation.reason, JSON.stringify(present(previous).fields), JSON.stringify(present(next).fields)]
      );
      await insertAuditEventForRequest(request, {
        entityType: 'order',
        entityId: orderId,
        entityLabel: `Naročilo ${String(previous.order_number)}`,
        action: 'updated',
        summary: 'Posodobljene dejanske meritve, vračila ali potrjena identiteta za poslovno analitiko',
        metadata: { reason: mutation.reason, measurement_revision: Number(next.analytics_measurement_revision), changed_fields: Object.keys(fields) }
      }, client);
      await client.query('commit');
      revalidateAdminOrderPaths(Number(orderId));
      return response(present(next));
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AnalyticsMeasurementValidationError) return response({ message: error.message }, 400);
    return response({ message: 'Meritev ni bilo mogoče shraniti. Nobena sprememba ni bila potrjena.' }, isDatabaseUnavailableError(error) ? 503 : 500);
  }
}
