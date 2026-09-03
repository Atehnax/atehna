import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { after } from 'next/server';
import type { Pool, PoolClient } from 'pg';
import {
  buildQuoteDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { getOrderDocumentTemplate } from '@/shared/server/orderDocumentTemplates';
import { generateOrderPdf, type PdfItem, type PdfOrder } from '@/shared/server/pdf';
import { getSiteLogoConfig } from '@/shared/server/siteLogo';
import { resolveSiteLogoArtwork } from '@/shared/server/siteLogoArtwork';
import { getQuoteCustomerMessage } from '@/shared/domain/quote/quoteCustomerMessage';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import { processQuoteEmailJobs } from '@/shared/server/quoteEmailJobs';

type ClaimedJob = {
  id: number;
  claimId: string;
  offerVersionId: number;
  attempts: number;
  payload: unknown;
};

const ISSUED_LIFECYCLE_STATUSES = new Set([
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
]);

function hasIssuedLifecycleSnapshot(offer: Record<string, unknown>): boolean {
  return (
    ISSUED_LIFECYCLE_STATUSES.has(String(offer.status)) &&
    Boolean(offer.offer_number) &&
    Boolean(offer.issued_at) &&
    Boolean(offer.content_hash) &&
    Boolean(offer.terms_hash)
  );
}

async function claim(
  pool: Pool,
  offerVersionId: number | null = null
): Promise<ClaimedJob | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const targetFilter = offerVersionId === null
      ? ''
      : 'quote_offer_version_id = $1 and';
    const result = await client.query(
      `
        select id, quote_offer_version_id, attempts, payload_json
        from quote_document_jobs
        where ${targetFilter} (
          status = 'pending' and next_attempt_at <= now()
        ) or (
          ${offerVersionId === null ? '' : 'quote_offer_version_id = $1 and'}
          status = 'processing' and locked_at < now() - interval '5 minutes'
        )
        order by next_attempt_at, id
        for update skip locked
        limit 1
      `,
      offerVersionId === null ? [] : [offerVersionId]
    );
    const row = result.rows[0];
    if (!row) {
      await client.query('commit');
      return null;
    }
    const claimId = randomUUID();
    await client.query(
      `
        update quote_document_jobs
        set status = 'processing',
            attempts = attempts + 1,
            claim_id = $2,
            locked_at = now(),
            updated_at = now()
        where id = $1
      `,
      [row.id, claimId]
    );
    await client.query('commit');
    return {
      id: Number(row.id),
      claimId,
      offerVersionId: Number(row.quote_offer_version_id),
      attempts: Number(row.attempts) + 1,
      payload: row.payload_json
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function frozenIssuedPdf(
  value: unknown,
  offer: Record<string, unknown>
): { bytes: Buffer; contentSha256: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Opravilo nima nespremenljivega posnetka dokumenta.');
  }
  const payload = value as Record<string, unknown>;
  if (
    payload.payloadVersion !== 1 ||
    payload.contentHash !== offer.content_hash ||
    payload.termsHash !== offer.terms_hash ||
    payload.offerNumber !== offer.offer_number ||
    payload.documentNumber !== offer.offer_number ||
    typeof payload.renderedPdfBase64 !== 'string' ||
    typeof payload.renderedDocumentSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(payload.renderedDocumentSha256)
  ) {
    throw new Error('Posnetek dokumenta se ne ujema z izdano ponudbo.');
  }
  const bytes = Buffer.from(payload.renderedPdfBase64, 'base64');
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length === 0 || contentSha256 !== payload.renderedDocumentSha256) {
    throw new Error('Nespremenljivi posnetek dokumenta je poškodovan.');
  }
  return { bytes, contentSha256 };
}

type QuotePdfQueryable = Pick<PoolClient, 'query'>;

export async function renderQuoteOfferPdf(
  database: QuotePdfQueryable,
  quoteOfferVersionId: number,
  options: { mode: 'preview' | 'issued' }
): Promise<{
  bytes: Uint8Array;
  documentNumber: string;
  quoteRequestId: number;
  requestNumber: string;
  versionNumber: number;
}> {
  const snapshotResult = await database.query(
    `
      select
        offer.*,
        request.request_number,
        request.customer_type,
        request.organization_name,
        request.contact_name,
        request.email,
        request.address_line1,
        request.address_line2,
        request.city,
        request.postal_code,
        request.reference,
        request.voided_at
      from quote_offer_versions offer
      join quote_requests request on request.id = offer.quote_request_id
      where offer.id = $1
    `,
    [quoteOfferVersionId]
  );
  const offer = snapshotResult.rows[0];
  const renderable =
    offer &&
    !offer.voided_at &&
    (options.mode === 'preview'
      ? offer.status === 'draft'
      : hasIssuedLifecycleSnapshot(offer));
  if (!renderable) {
    throw new Error(
      options.mode === 'preview'
        ? 'Predogled je dovoljen samo za shranjen osnutek.'
        : 'Dokument je mogoče izdelati samo za izdano ponudbo.'
    );
  }
  if (options.mode === 'issued' && !offer.offer_number) {
    throw new Error('Izdana ponudba nima številke dokumenta.');
  }
  const itemsResult = await database.query(
    `
      select *
      from quote_offer_version_items
      where quote_offer_version_id = $1
      order by line_number
    `,
    [quoteOfferVersionId]
  );
  if (itemsResult.rowCount === 0) {
    throw new Error('Ponudba mora vsebovati vsaj eno postavko.');
  }
  const issuedAt = offer.issued_at
    ? new Date(String(offer.issued_at))
    : new Date();
  const documentNumber = offer.offer_number
    ? String(offer.offer_number)
    : `PREDOGLED-${String(offer.request_number)}-V${Number(offer.version_number)}`;
  const pdfOrder: PdfOrder = {
    customerType: String(offer.customer_type),
    organizationName:
      offer.organization_name === null ? null : String(offer.organization_name),
    contactName: String(offer.contact_name),
    email: String(offer.email),
    deliveryAddress: [
      offer.address_line1,
      offer.address_line2,
      [offer.postal_code, offer.city].filter(Boolean).join(' ')
    ]
      .filter(Boolean)
      .join(', '),
    reference: offer.reference === null ? null : String(offer.reference),
    notes: [
      options.mode === 'preview'
        ? 'PREDOGLED – ponudba še ni izdana in je ni mogoče sprejeti.'
        : null,
      getQuoteCustomerMessage(
        offer.seller_message,
        offer.customer_visible_notes
      ),
      offer.delivery_terms
        ? `Dobavni pogoji: ${offer.delivery_terms}`
        : null,
      offer.payment_terms
        ? `Plačilni pogoji: ${offer.payment_terms}`
        : null,
      offer.acceptance_method
        ? `Način sprejema: ${offer.acceptance_method}`
        : null,
      offer.terms_text
        ? `Pogoji sprejema: ${offer.terms_text}`
        : null,
      offer.valid_until
        ? `Ponudba velja do: ${new Date(String(offer.valid_until)).toLocaleDateString('sl-SI')}`
        : null
    ]
      .filter(Boolean)
      .join('\n'),
    createdAt: issuedAt,
    subtotal: number(offer.subtotal),
    tax: number(offer.tax),
    taxRate: number(offer.tax_rate),
    shipping: number(offer.shipping),
    shippingOverride: true,
    total: number(offer.total)
  };
  const pdfItems: PdfItem[] = itemsResult.rows.map((item) => ({
    sku: String(item.sku),
    name: `${item.product_name} – ${item.variant_name}`,
    unit: item.unit === null ? null : String(item.unit),
    quantity: number(item.quantity),
    unitPrice: number(item.unit_net),
    lineTotal: number(item.line_net),
    taxRate: number(item.tax_rate),
    discountPercentage: number(item.discount_pct)
  }));
  const [template, logoConfig] = await Promise.all([
    getOrderDocumentTemplate('offer'),
    getSiteLogoConfig()
  ]);
  const logoArtwork = await resolveSiteLogoArtwork(logoConfig, 'pdf-document');
  const bytes = await generateOrderPdf({
    type: 'offer',
    template,
    order: pdfOrder,
    items: pdfItems,
    documentNumber,
    issuedAt,
    logoConfig,
    logoArtwork: logoArtwork?.bytes ?? null
  });
  return {
    bytes,
    documentNumber,
    quoteRequestId: Number(offer.quote_request_id),
    requestNumber: String(offer.request_number),
    versionNumber: Number(offer.version_number)
  };
}

export async function processQuoteDocumentJobs(
  pool: Pool,
  options: { maximumJobs?: number; offerVersionId?: number } = {}
): Promise<{ completed: number; retried: number; suppressed: number }> {
  const result = { completed: 0, retried: 0, suppressed: 0 };
  const maximumJobs = Math.max(1, Math.min(10, options.maximumJobs ?? 2));
  const offerVersionId = options.offerVersionId ?? null;
  if (
    offerVersionId !== null &&
    (!Number.isSafeInteger(offerVersionId) || offerVersionId <= 0)
  ) {
    throw new Error('Neveljaven ID različice ponudbe.');
  }
  for (let index = 0; index < maximumJobs; index += 1) {
    const job = await claim(pool, offerVersionId);
    if (!job) break;
    let uploadedPath: string | null = null;
    try {
      const requestIdentity = await pool.query(
        `
          select offer.quote_request_id
          from quote_offer_versions offer
          where offer.id = $1
        `,
        [job.offerVersionId]
      );
      const quoteRequestId = Number(requestIdentity.rows[0]?.quote_request_id);
      if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
        await pool.query(
          `
            update quote_document_jobs
            set status = 'completed',
                claim_id = null,
                locked_at = null,
                last_error = '[suppressed] Različica nikoli ni bila veljavno izdana.',
                completed_at = now(),
                updated_at = now()
            where id = $1 and claim_id = $2
          `,
          [job.id, job.claimId]
        );
        result.suppressed += 1;
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('begin');
        await lockQuoteWorkflow(client, quoteRequestId);
        const locked = await client.query(
          `
            select offer.id, offer.status, offer.document_sha256,
                   offer.content_hash, offer.terms_hash, offer.offer_number,
                   offer.issued_at, request.voided_at
            from quote_offer_versions offer
            join quote_requests request on request.id = offer.quote_request_id
            where offer.id = $1
              and request.id = $2
            for update of offer
          `,
          [job.offerVersionId, quoteRequestId]
        );
        const current = locked.rows[0];
        if (current?.voided_at) {
          await client.query(
            `
              update quote_document_jobs
              set status = 'completed',
                  claim_id = null,
                  locked_at = null,
                  last_error = '[voided_request] Povpraševanje je bilo odstranjeno.',
                  completed_at = now(),
                  updated_at = now()
              where id = $1 and claim_id = $2
            `,
            [job.id, job.claimId]
          );
          await client.query('commit');
          result.suppressed += 1;
          continue;
        }
        if (!current || !hasIssuedLifecycleSnapshot(current)) {
          await client.query(
            `
              update quote_document_jobs
              set status = 'completed',
                  claim_id = null,
                  locked_at = null,
                  last_error = '[suppressed] Različica nikoli ni bila veljavno izdana.',
                  completed_at = now(),
                  updated_at = now()
              where id = $1 and claim_id = $2
            `,
            [job.id, job.claimId]
          );
          await client.query('commit');
          result.suppressed += 1;
          continue;
        }
        const frozenDocument = frozenIssuedPdf(job.payload, current);
        const pdfBytes = frozenDocument.bytes;
        const contentSha256 = frozenDocument.contentSha256;
        const customerAccessId = randomUUID();
        const blob = await uploadPrivateOrderDocumentBlob(
          buildQuoteDocumentBlobPath(customerAccessId, 'pdf'),
          Buffer.from(pdfBytes),
          'application/pdf'
        );
        uploadedPath = blob.pathname;
        if (
          current.document_sha256 &&
          String(current.document_sha256) !== contentSha256
        ) {
          throw new Error('Izdana ponudba že vsebuje drug dokument.');
        }
        const documentInsert = await client.query(
          `
            insert into quote_documents (
              quote_offer_version_id,
              customer_access_id,
              document_type,
              filename,
              blob_pathname,
              version_number,
              document_number,
              issued_at,
              content_sha256,
              offer_content_hash,
              terms_hash,
              created_by_actor_type
            )
            values (
              $1, $2, 'offer', $3, $4, 1, $5, $6, $7, $8, $9, 'system'
            )
            on conflict (quote_offer_version_id, document_type, version_number)
            do nothing
            returning id
          `,
          [
            job.offerVersionId,
            customerAccessId,
            `${current.offer_number}.pdf`,
            blob.pathname,
            current.offer_number,
            current.issued_at,
            contentSha256,
            current.content_hash,
            current.terms_hash
          ]
        );
        if (documentInsert.rowCount !== 1) {
          const existingDocument = await client.query(
            `
              select content_sha256
              from quote_documents
              where quote_offer_version_id = $1
                and document_type = 'offer'
                and version_number = 1
            `,
            [job.offerVersionId]
          );
          if (
            String(existingDocument.rows[0]?.content_sha256 ?? '') !==
            contentSha256
          ) {
            throw new Error('Ponudba že vsebuje drug nespremenljiv dokument.');
          }
          await deletePrivateOrderDocumentBlob(blob.pathname).catch(() => undefined);
          uploadedPath = null;
        }
        await client.query(
          `
            update quote_offer_versions
            set document_sha256 = coalesce(document_sha256, $2),
                document_bound_at = coalesce(document_bound_at, now()),
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
          `,
          [job.offerVersionId, contentSha256]
        );
        await client.query(
          `
            update quote_document_jobs
            set status = 'completed',
                claim_id = null,
                locked_at = null,
                last_error = null,
                completed_at = now(),
                updated_at = now()
            where id = $1 and claim_id = $2
          `,
          [job.id, job.claimId]
        );
        await client.query('commit');
        uploadedPath = null;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
      result.completed += 1;
    } catch (error) {
      if (uploadedPath) {
        await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
      }
      const delayMs = Math.min(
        6 * 60 * 60 * 1_000,
        30_000 * 2 ** Math.max(0, job.attempts - 1)
      );
      const retryUpdate = await pool.query(
        `
          update quote_document_jobs job
          set status = case
                when request_record.voided_at is null then 'pending'
                else 'completed'
              end,
              claim_id = null,
              locked_at = null,
              next_attempt_at = now() + ($3::bigint * interval '1 millisecond'),
              last_error = case
                when request_record.voided_at is null then $4
                else '[voided_request] Povpraševanje je bilo odstranjeno.'
              end,
              completed_at = case
                when request_record.voided_at is null then job.completed_at
                else coalesce(job.completed_at, now())
              end,
              updated_at = now()
          from quote_offer_versions offer
          join quote_requests request_record
            on request_record.id = offer.quote_request_id
          where job.id = $1
            and job.claim_id = $2
            and offer.id = job.quote_offer_version_id
          returning job.status
        `,
        [
          job.id,
          job.claimId,
          delayMs,
          String(error instanceof Error ? error.message : 'PDF generation failed')
            .slice(0, 2_000)
        ]
      );
      if (retryUpdate.rows[0]?.status === 'completed') result.suppressed += 1;
      else result.retried += 1;
    }
  }
  return result;
}

export function scheduleQuoteDocumentJobs(pool: Pool): void {
  after(async () => {
    const result = await processQuoteDocumentJobs(pool, { maximumJobs: 2 }).catch((error) => {
      console.error('[quote-document] background processing failed', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    });
    if (!result || result.completed === 0) return;
    await pool.query(
      `
        update quote_email_jobs email_job
        set next_attempt_at = now(),
            updated_at = now()
        where email_job.audience = 'customer'
          and email_job.event_type = 'quote_issued'
          and email_job.status = 'pending'
          and email_job.last_error like '[document_pending]%'
          and exists (
            select 1
            from quote_documents document
            where document.quote_offer_version_id = email_job.quote_offer_version_id
              and document.document_type = 'offer'
              and document.version_number = 1
          )
      `
    );
    await processQuoteEmailJobs(pool, { limit: 10 }).catch((error) => {
      console.error('[quote-document] email wake-up failed', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  });
}
