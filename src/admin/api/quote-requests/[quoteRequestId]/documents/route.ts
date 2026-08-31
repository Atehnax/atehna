import { NextResponse } from 'next/server';
import type { Pool } from 'pg';
import { getPool } from '@/shared/server/db';
import { processQuoteDocumentJobs } from '@/shared/server/quoteDocumentJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { requestOriginMatchesHost } from '@/shared/server/requestSecurity';
import {
  isManualQuoteDocumentUpload,
  uploadManualQuoteDocument
} from '@/admin/api/quote-requests/[quoteRequestId]/documents/manualQuoteDocumentUpload';
import {
  hasValidQuoteAdminSession,
  positiveInteger
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

const ISSUED_LIFECYCLE_STATUSES = new Set([
  'issued',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'superseded'
]);

type QuoteDocumentRow = {
  id: string | number;
  quote_offer_version_id: string | number;
  document_type: string;
  filename: string;
  document_number: string;
  issued_at: string | Date;
  content_sha256: string;
  offer_content_hash: string;
  created_at: string | Date;
};

function serializeDocument(
  quoteRequestId: number,
  row: QuoteDocumentRow
) {
  return {
    id: Number(row.id),
    offerVersionId: Number(row.quote_offer_version_id),
    documentType: row.document_type,
    filename: row.filename,
    documentNumber: row.document_number,
    issuedAt: new Date(row.issued_at).toISOString(),
    contentSha256: row.content_sha256,
    offerContentHash: row.offer_content_hash,
    createdAt: new Date(row.created_at).toISOString(),
    source: 'generated' as const,
    byteSize: null,
    mimeType: 'application/pdf',
    url: `/api/admin/quote-requests/${quoteRequestId}/documents/${row.id}`
  };
}

async function findOfferDocument(
  pool: Pool,
  quoteRequestId: number,
  offerVersionId: number
) {
  const result = await pool.query<QuoteDocumentRow>(
    `
      select document.id, document.quote_offer_version_id,
             document.document_type, document.filename,
             document.document_number, document.issued_at,
             document.content_sha256, document.offer_content_hash,
             document.created_at
      from quote_documents document
      join quote_offer_versions offer
        on offer.id = document.quote_offer_version_id
      where offer.quote_request_id = $1
        and offer.id = $2
        and document.document_type = 'offer'
      limit 1
    `,
    [quoteRequestId, offerVersionId]
  );
  return result.rows[0] ?? null;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json(
      { message: 'Ponudbe niso omogočene.' },
      { status: 404, headers: PRIVATE_HEADERS }
    );
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401, headers: PRIVATE_HEADERS }
    );
  }
  if (!requestOriginMatchesHost(request)) {
    return NextResponse.json(
      { message: 'Izvor zahteve ni dovoljen.' },
      { status: 403, headers: PRIVATE_HEADERS }
    );
  }

  const { quoteRequestId: rawQuoteRequestId } = await props.params;
  const quoteRequestId = positiveInteger(rawQuoteRequestId);
  if (!quoteRequestId) {
    return NextResponse.json(
      { message: 'Neveljaven ID povpraševanja.' },
      { status: 400, headers: PRIVATE_HEADERS }
    );
  }
  if (isManualQuoteDocumentUpload(request)) {
    return uploadManualQuoteDocument(request, quoteRequestId, PRIVATE_HEADERS);
  }

  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const offerVersionId = positiveInteger(parsed.body.offerVersionId);
  if (!offerVersionId) {
    return NextResponse.json(
      { message: 'Neveljaven ID različice ponudbe.' },
      { status: 400, headers: PRIVATE_HEADERS }
    );
  }

  try {
    const pool = await getPool();
    const offerResult = await pool.query(
      `
        select offer.id, offer.status, offer.offer_number,
               offer.issued_at, offer.content_hash, offer.terms_hash,
               request_record.voided_at
        from quote_offer_versions offer
        join quote_requests request_record
          on request_record.id = offer.quote_request_id
        where offer.id = $1
          and offer.quote_request_id = $2
        limit 1
      `,
      [offerVersionId, quoteRequestId]
    );
    const offer = offerResult.rows[0] as
      | {
          id: number;
          status: string;
          offer_number: string | null;
          issued_at: string | null;
          content_hash: string | null;
          terms_hash: string | null;
          voided_at: string | null;
        }
      | undefined;
    if (offer?.voided_at) {
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in dokumentov ni več mogoče ustvarjati.'
        },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }
    if (
      !offer ||
      !ISSUED_LIFECYCLE_STATUSES.has(String(offer.status)) ||
      !offer.offer_number ||
      !offer.issued_at ||
      !offer.content_hash ||
      !offer.terms_hash
    ) {
      return NextResponse.json(
        { message: 'PDF je mogoče ustvariti samo za izdano ponudbo.' },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }

    const existingDocument = await findOfferDocument(
      pool,
      quoteRequestId,
      offerVersionId
    );
    if (existingDocument) {
      return NextResponse.json(
        {
          message: 'PDF ponudbe je že ustvarjen.',
          created: false,
          document: serializeDocument(quoteRequestId, existingDocument)
        },
        { headers: PRIVATE_HEADERS }
      );
    }

    const jobResult = await pool.query(
      `
        select id, status, locked_at
        from quote_document_jobs
        where quote_offer_version_id = $1
          and document_type = 'offer'
        limit 1
      `,
      [offerVersionId]
    );
    const job = jobResult.rows[0] as
      | { id: number; status: string; locked_at: string | null }
      | undefined;
    if (!job) {
      return NextResponse.json(
        {
          message:
            'Nespremenljivi posnetek izdane ponudbe ni na voljo. PDF-ja ni mogoče varno ustvariti.'
        },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }

    if (job.status === 'pending') {
      await pool.query(
        `
          update quote_document_jobs
          set next_attempt_at = now(),
              updated_at = now()
          where id = $1
            and status = 'pending'
        `,
        [job.id]
      );
    } else if (job.status === 'completed') {
      return NextResponse.json(
        {
          message:
            'Zapis izdelave je zaključen, dokument pa manjka. Potrebna je tehnična preverba.'
        },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }

    const processing = await processQuoteDocumentJobs(pool, {
      maximumJobs: 1,
      offerVersionId
    });
    const generatedDocument = await findOfferDocument(
      pool,
      quoteRequestId,
      offerVersionId
    );
    if (generatedDocument) {
      return NextResponse.json(
        {
          message: 'PDF ponudbe je ustvarjen.',
          created: true,
          document: serializeDocument(quoteRequestId, generatedDocument)
        },
        { status: 201, headers: PRIVATE_HEADERS }
      );
    }
    if (processing.suppressed > 0) {
      return NextResponse.json(
        { message: 'Ta različica ponudbe nima veljavnega posnetka izdaje.' },
        { status: 409, headers: PRIVATE_HEADERS }
      );
    }
    if (processing.retried > 0) {
      return NextResponse.json(
        {
          message:
            'PDF ponudbe trenutno ni bilo mogoče ustvariti. Poskusite znova.'
        },
        { status: 503, headers: PRIVATE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        message: 'PDF ponudbe se že ustvarja. Čez trenutek osvežite stran.',
        pending: true
      },
      { status: 202, headers: PRIVATE_HEADERS }
    );
  } catch (error) {
    console.error('[quotes.documents.generate] failed', {
      quoteRequestId,
      offerVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'PDF-ja ponudbe trenutno ni mogoče ustvariti.' },
      { status: 500, headers: PRIVATE_HEADERS }
    );
  }
}
