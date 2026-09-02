import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  planFailedOrderEmailJobRetries,
  resetFailedOrderEmailJobs,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import {
  getOrderEmailAdminState,
  getOrderEmailSettings
} from '@/shared/server/orderEmailSettings';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requireAdminCustomerEmailConfirmationForDeliveries } from '@/shared/server/adminCustomerEmailConfirmationToken';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `select key
       from order_email_settings
       where key = 'order-email-notifications'
       for share`
    );
    const settings = await getOrderEmailSettings(client);
    const plan = await planFailedOrderEmailJobRetries(client, settings);
    const confirmationChallenge =
      requireAdminCustomerEmailConfirmationForDeliveries({
        action: plan.customerBatchAction,
        actionLabel: 'Ponovni poskus neuspelih e-poštnih sporočil',
        confirmationToken: bodyResult.body.customerEmailConfirmationToken,
        confirmCustomerEmails: settings.confirmCustomerEmails,
        deliveries: plan.customerDeliveries.map((delivery) => ({
          scope: 'order' as const,
          entityId: delivery.orderId,
          eventType: delivery.eventType,
          eventLabel: delivery.eventLabel,
          recipientEmail: delivery.recipientEmail,
          masterEmailEnabled: settings.enabled,
          customerAudienceEnabled:
            settings.events[delivery.eventType].customer
        }))
      });
    if (confirmationChallenge) {
      await client.query('rollback');
      return NextResponse.json(confirmationChallenge, { status: 428 });
    }

    const resetCount = await resetFailedOrderEmailJobs(
      client,
      plan.eligibleJobIds
    );
    await client.query('commit');
    if (resetCount > 0) scheduleOrderEmailJobs(pool);
    return NextResponse.json({
      resetCount,
      skippedCount: plan.skippedCount,
      message: resetCount > 0
        ? `${resetCount} neuspelih e-poštnih opravil je znova uvrščenih.`
        : 'Med neuspelimi opravili ni bilo nobenega varnega za ponovni poskus.',
      state: await getOrderEmailAdminState()
    });
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[orders.email-job] failed retry request', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Ponovni poskus pošiljanja ni uspel.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
