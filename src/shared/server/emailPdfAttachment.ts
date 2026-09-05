import 'server-only';

import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  EMAIL_PDF_ATTACHMENT_MAX_BYTES,
  isEmailPdfSha256,
  isPinnedEmailPdfDocumentReference,
  isSafeEmailPdfFilename,
  pinEmailPdfDocumentReference,
  type EmailProviderPdfAttachment,
  type OrderEmailPdfDocumentReference,
  type QuoteEmailPdfDocumentReference,
  type TransactionalEmailPdfDocumentReference
} from '@/shared/domain/emailPdfAttachment';
import { readPrivateOrderDocumentBlob } from '@/shared/server/blob';

type Queryable = Pick<Pool | PoolClient, 'query'>;

type ResolvedDocument = Readonly<{
  reference: TransactionalEmailPdfDocumentReference;
  blobPathname: string;
}>;

type DocumentRow = {
  document_id: string | number | null;
  filename: string | null;
  blob_pathname: string | null;
  content_sha256: string | null;
  legal_status?: string | null;
  format_marker?: string | null;
  deleted_at?: string | null;
  job_status: string | null;
};

export class EmailPdfDocumentPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailPdfDocumentPendingError';
  }
}

export class EmailPdfDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailPdfDocumentValidationError';
  }
}

function validateResolvedRow(
  reference: TransactionalEmailPdfDocumentReference,
  row: DocumentRow | undefined
): ResolvedDocument {
  if (!row?.document_id) {
    if (row?.job_status === 'pending' || row?.job_status === 'processing') {
      throw new EmailPdfDocumentPendingError(
        'PDF document generation has not completed yet.'
      );
    }
    throw new EmailPdfDocumentValidationError(
      'The referenced PDF document is unavailable.'
    );
  }
  const documentId = Number(row.document_id);
  if (
    !Number.isSafeInteger(documentId) ||
    documentId <= 0 ||
    !isEmailPdfSha256(row.content_sha256) ||
    !isSafeEmailPdfFilename(row.filename) ||
    typeof row.blob_pathname !== 'string' ||
    !row.blob_pathname.trim()
  ) {
    throw new EmailPdfDocumentValidationError(
      'The referenced PDF document metadata is invalid.'
    );
  }
  if (
    reference.documentId !== null &&
    reference.documentId !== documentId
  ) {
    throw new EmailPdfDocumentValidationError(
      'The pinned PDF document ID no longer matches.'
    );
  }
  if (
    reference.contentSha256 !== null &&
    reference.contentSha256 !== row.content_sha256
  ) {
    throw new EmailPdfDocumentValidationError(
      'The pinned PDF document hash no longer matches.'
    );
  }
  if (
    reference.filename !== null &&
    reference.filename !== row.filename
  ) {
    throw new EmailPdfDocumentValidationError(
      'The pinned PDF document filename no longer matches.'
    );
  }
  return {
    reference: pinEmailPdfDocumentReference(reference, {
      documentId,
      contentSha256: row.content_sha256,
      filename: row.filename
    }),
    blobPathname: row.blob_pathname
  };
}

async function resolveOrderDocument(
  database: Queryable,
  reference: OrderEmailPdfDocumentReference
): Promise<ResolvedDocument> {
  const result = await database.query(
    `
      select
        document.id as document_id,
        document.filename,
        document.blob_pathname,
        document.content_sha256,
        document.legal_status,
        document.format_marker,
        document.deleted_at,
        (
          select job.status
          from order_document_jobs job
          where job.order_id = order_record.id
            and job.document_type = $2
          order by job.id asc
          limit 1
        ) as job_status
      from orders order_record
      left join order_documents document
        on document.order_id = order_record.id
       and document.type = $2
       and document.version_number = $3
       and document.order_pricing_revision = order_record.pricing_revision
       and document.order_delivery_plan_revision = order_record.delivery_plan_revision
      where order_record.id = $1
        and order_record.deleted_at is null
      limit 1
    `,
    [reference.orderId, reference.documentType, reference.versionNumber]
  );
  const row = result.rows[0] as DocumentRow | undefined;
  if (row?.document_id) {
    if (
      row.deleted_at !== null ||
      row.legal_status !== 'operational' ||
      row.format_marker !== 'atehna-template-pdf-v3'
    ) {
      throw new EmailPdfDocumentValidationError(
        'The referenced order PDF is not an active generated document.'
      );
    }
  }
  return validateResolvedRow(reference, row);
}

async function resolveQuoteDocument(
  database: Queryable,
  reference: QuoteEmailPdfDocumentReference
): Promise<ResolvedDocument> {
  const result = await database.query(
    `
      select
        document.id as document_id,
        document.filename,
        document.blob_pathname,
        document.content_sha256,
        null::text as legal_status,
        null::text as format_marker,
        null::timestamptz as deleted_at,
        job.status as job_status
      from quote_offer_versions offer
      join quote_requests request_record
        on request_record.id = offer.quote_request_id
      left join quote_documents document
        on document.quote_offer_version_id = offer.id
       and document.document_type = 'offer'
       and document.version_number = 1
       and document.offer_content_hash = offer.content_hash
       and document.terms_hash = offer.terms_hash
       and document.content_sha256 = offer.document_sha256
      left join quote_document_jobs job
        on job.quote_offer_version_id = offer.id
       and job.document_type = 'offer'
      where request_record.id = $1
        and offer.id = $2
      limit 1
    `,
    [reference.quoteRequestId, reference.quoteOfferVersionId]
  );
  return validateResolvedRow(
    reference,
    result.rows[0] as DocumentRow | undefined
  );
}

async function resolveDocument(
  database: Queryable,
  reference: TransactionalEmailPdfDocumentReference
): Promise<ResolvedDocument> {
  return reference.source === 'order_document'
    ? resolveOrderDocument(database, reference)
    : resolveQuoteDocument(database, reference);
}

export async function pinEmailPdfDocument(
  database: Queryable,
  reference: TransactionalEmailPdfDocumentReference
): Promise<TransactionalEmailPdfDocumentReference> {
  return (await resolveDocument(database, reference)).reference;
}

export function validateEmailPdfAttachmentBytes(input: {
  bytes: Uint8Array;
  declaredSize: number;
  contentType: string;
  expectedSha256: string;
  filename: string;
}): EmailProviderPdfAttachment {
  const contentType = input.contentType.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/pdf') {
    throw new EmailPdfDocumentValidationError(
      'The referenced email attachment is not a PDF.'
    );
  }
  if (
    !Number.isSafeInteger(input.declaredSize) ||
    input.declaredSize <= 0 ||
    input.declaredSize > EMAIL_PDF_ATTACHMENT_MAX_BYTES ||
    input.bytes.byteLength !== input.declaredSize
  ) {
    throw new EmailPdfDocumentValidationError(
      'The referenced email PDF has an invalid size.'
    );
  }
  const bytes = Buffer.from(input.bytes);
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new EmailPdfDocumentValidationError(
      'The referenced email PDF has an invalid file signature.'
    );
  }
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (!isEmailPdfSha256(input.expectedSha256) || actualSha256 !== input.expectedSha256) {
    throw new EmailPdfDocumentValidationError(
      'The referenced email PDF failed its integrity check.'
    );
  }
  if (!isSafeEmailPdfFilename(input.filename)) {
    throw new EmailPdfDocumentValidationError(
      'The referenced email PDF filename is unsafe.'
    );
  }
  return Object.freeze({
    content: bytes.toString('base64'),
    filename: input.filename
  });
}

export async function hydrateEmailPdfDocument(
  database: Queryable,
  reference: TransactionalEmailPdfDocumentReference
): Promise<Readonly<{
  reference: TransactionalEmailPdfDocumentReference;
  attachment: EmailProviderPdfAttachment;
}>> {
  const resolved = await resolveDocument(database, reference);
  if (!isPinnedEmailPdfDocumentReference(resolved.reference)) {
    throw new EmailPdfDocumentValidationError(
      'The email PDF reference could not be pinned.'
    );
  }
  const expectedSha256 = resolved.reference.contentSha256;
  const filename = resolved.reference.filename;
  if (expectedSha256 === null || filename === null) {
    throw new EmailPdfDocumentValidationError(
      'The email PDF reference is missing its immutable pin.'
    );
  }
  let blob;
  try {
    blob = await readPrivateOrderDocumentBlob(resolved.blobPathname);
  } catch (error) {
    throw new EmailPdfDocumentPendingError(
      error instanceof Error
        ? `The private PDF blob is temporarily unavailable: ${error.message}`
        : 'The private PDF blob is temporarily unavailable.'
    );
  }
  if (!blob) {
    throw new EmailPdfDocumentPendingError(
      'The private PDF blob has not become available yet.'
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  } catch {
    throw new EmailPdfDocumentPendingError(
      'The private PDF blob could not be read yet.'
    );
  }
  return Object.freeze({
    reference: resolved.reference,
    attachment: validateEmailPdfAttachmentBytes({
      bytes,
      declaredSize: blob.size,
      contentType: blob.contentType,
      expectedSha256,
      filename
    })
  });
}
