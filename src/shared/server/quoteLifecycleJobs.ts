import 'server-only';

import type { Pool } from 'pg';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';

type ExpiringOffer = {
  id: string | number;
  quote_request_id: string | number;
  offer_number: string;
};

export async function expireDueQuoteOffers(
  pool: Pool,
  options: { maximumOffers?: number } = {}
): Promise<{ expired: number; emailsQueued: number }> {
  const maximumOffers = Math.max(
    1,
    Math.min(250, Math.trunc(options.maximumOffers ?? 100))
  );
  const client = await pool.connect();
  let emailsQueued = 0;
  try {
    await client.query('begin');
    const candidates = await client.query<ExpiringOffer>(
      `
        select offer.id, offer.quote_request_id, offer.offer_number
        from quote_offer_versions offer
        join quote_requests request on request.id = offer.quote_request_id
        where offer.status = 'issued'
          and offer.is_current = true
          and offer.valid_until <= now()
          and request.status <> 'awaiting_purchase_order_review'
          and request.voided_at is null
        order by offer.valid_until, offer.id
        limit $1
      `,
      [maximumOffers]
    );
    const quoteRequestIds = Array.from(
      new Set(candidates.rows.map((row) => Number(row.quote_request_id)))
    ).sort((left, right) => left - right);
    for (const quoteRequestId of quoteRequestIds) {
      await lockQuoteWorkflow(client, quoteRequestId);
    }
    const candidateOfferIds = candidates.rows.map((row) => Number(row.id));
    const due =
      candidateOfferIds.length === 0
        ? { rows: [] as ExpiringOffer[], rowCount: 0 }
        : await client.query<ExpiringOffer>(
            `
              select offer.id, offer.quote_request_id, offer.offer_number
              from quote_offer_versions offer
              join quote_requests request on request.id = offer.quote_request_id
              where offer.id = any($1::bigint[])
                and offer.status = 'issued'
                and offer.is_current = true
                and offer.valid_until <= now()
                and request.status <> 'awaiting_purchase_order_review'
                and request.voided_at is null
              order by offer.valid_until, offer.id
              for update of offer, request skip locked
            `,
            [candidateOfferIds]
          );
    for (const row of due.rows) {
      const offerId = Number(row.id);
      const quoteRequestId = Number(row.quote_request_id);
      const expiredAt = new Date().toISOString();
      await client.query(
        `
          update quote_offer_versions
          set status = 'expired',
              is_current = false,
              expired_at = $2,
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
        `,
        [offerId, expiredAt]
      );
      await client.query(
        `
          update quote_requests
          set status = 'expired',
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
            and status = 'offer_issued'
        `,
        [quoteRequestId]
      );
      await client.query(
        `
          update quote_access_tokens
          set scopes = array_remove(array_remove(scopes, 'offer_response'), 'purchase_order')
          where quote_offer_version_id = $1
            and revoked_at is null
        `,
        [offerId]
      );
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key, event_type,
            actor_type, occurred_at, metadata_json
          )
          values ($1, $2, $3, 'offer_expired', 'system', $4, $5::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          quoteRequestId,
          offerId,
          `offer-expired:${offerId}`,
          expiredAt,
          JSON.stringify({ offerNumber: row.offer_number })
        ]
      );

      await client.query('savepoint quote_expiry_email');
      try {
        const jobs = await enqueueQuoteEmailEvent(client, {
          quoteRequestId,
          quoteOfferVersionId: offerId,
          eventKey: `quote-expired:${offerId}`,
          eventType: 'quote_expired'
        });
        emailsQueued += jobs.length;
        if (jobs.length > 0) {
          await client.query(
            `
              insert into quote_events (
                quote_request_id, quote_offer_version_id, event_key,
                event_type, actor_type, occurred_at, metadata_json
              )
              values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)
              on conflict (event_key) where event_key is not null do nothing
            `,
            [
              quoteRequestId,
              offerId,
              `quote-email-queued:expired:${offerId}`,
              JSON.stringify({ eventType: 'quote_expired', jobCount: jobs.length })
            ]
          );
        }
        await client.query('release savepoint quote_expiry_email');
      } catch (error) {
        await client.query('rollback to savepoint quote_expiry_email');
        await client.query('release savepoint quote_expiry_email');
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key,
              event_type, actor_type, occurred_at, metadata_json
            )
            values ($1, $2, $3, 'quote_email_provider_failed', 'system', now(), $4::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            quoteRequestId,
            offerId,
            `quote-email-enqueue-failed:expired:${offerId}`,
            JSON.stringify({ stage: 'enqueue', eventType: 'quote_expired' })
          ]
        );
        console.error('[quote-expiry] email enqueue failed', {
          quoteRequestId,
          offerId,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    await client.query('commit');
    if (emailsQueued > 0) scheduleQuoteEmailJobs(pool);
    return { expired: due.rowCount ?? due.rows.length, emailsQueued };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
