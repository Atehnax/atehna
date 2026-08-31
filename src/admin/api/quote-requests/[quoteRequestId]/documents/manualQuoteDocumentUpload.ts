import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  buildQuoteDocumentBlobPath,
  deletePrivateOrderDocumentBlob,
  uploadPrivateOrderDocumentBlob
} from '@/shared/server/blob';
import { getPool } from '@/shared/server/db';
import { revalidateAdminQuotePaths } from '@/shared/server/revalidateAdminQuotes';
import {
  appendQuoteEvent,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PDF_CONTENT_TYPE = 'application/pdf';
const MANUAL_DOCUMENT_TYPES = new Set(['offer', 'purchase_order']);

type ManualDocumentType = 'offer' | 'purchase_order';

type ManualUploadErrorCode =
  | 'QUOTE_MANUAL_DOCUMENT_INVALID_REQUEST'
  | 'QUOTE_MANUAL_DOCUMENT_SCOPE_MISMATCH'
  | 'QUOTE_REQUEST_VOIDED';

class ManualUploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: ManualUploadErrorCode,
    message: string
  ) {
    super(message);
  }
}

function isPdfFile(file: File): boolean {
  return (
    file.type.trim().toLowerCase() === PDF_CONTENT_TYPE ||
    file.name.trim().toLowerCase().endsWith('.pdf')
  );
}

function hasPdfSignature(bytes: Buffer): boolean {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-';
}

function safePdfFilename(value: string, documentType: ManualDocumentType): string {
  const normalized = value
    .replace(/[\\/\u0000-\u001f\u007f]/gu, '_')
    .trim()
    .slice(0, 180);
  if (!normalized) {
    return documentType === 'offer' ? 'ponudba.pdf' : 'narocilnica.pdf';
  }
  return normalized.toLowerCase().endsWith('.pdf')
    ? normalized
    : `${normalized}.pdf`;
}

function manualDocumentNumber(
  requestNumber: string,
  documentType: ManualDocumentType,
  versionNumber: number
): string {
  const typeLabel = documentType === 'offer' ? 'PONUDBA' : 'NAROCILNICA';
  return `ROCNA-${typeLabel}-${requestNumber}-V${versionNumber}`;
}

export function isManualQuoteDocumentUpload(request: Request): boolean {
  return (request.headers.get('content-type') ?? '')
    .toLowerCase()
    .startsWith('multipart/form-data');
}

export async function uploadManualQuoteDocument(
  request: Request,
  quoteRequestId: number,
  privateHeaders: HeadersInit
) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        code: 'QUOTE_MANUAL_DOCUMENT_INVALID_REQUEST',
        message: 'Podatkov za nalaganje dokumenta ni bilo mogoče prebrati.'
      },
      { status: 400, headers: privateHeaders }
    );
  }

  const file = formData.get('file');
  const rawType = formData.get('type');
  const offerVersionId = positiveInteger(formData.get('offerVersionId'));
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: 'Datoteka manjka.' },
      { status: 400, headers: privateHeaders }
    );
  }
  const normalizedType =
    typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
  if (!MANUAL_DOCUMENT_TYPES.has(normalizedType)) {
    return NextResponse.json(
      { message: 'Neveljavna vrsta dokumenta.' },
      { status: 400, headers: privateHeaders }
    );
  }
  if (!offerVersionId) {
    return NextResponse.json(
      { message: 'Različica ponudbe manjka.' },
      { status: 400, headers: privateHeaders }
    );
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: 'Datoteka mora biti manjša od 10 MB.' },
      { status: 400, headers: privateHeaders }
    );
  }
  if (!isPdfFile(file)) {
    return NextResponse.json(
      { message: 'Dovoljeni so samo PDF-ji.' },
      { status: 400, headers: privateHeaders }
    );
  }

  const documentType = normalizedType as ManualDocumentType;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasPdfSignature(bytes)) {
    return NextResponse.json(
      { message: 'Datoteka ni veljaven PDF.' },
      { status: 400, headers: privateHeaders }
    );
  }

  const filename = safePdfFilename(file.name, documentType);
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  let clientReleased = false;
  let transactionStarted = false;
  let commitAttempted = false;
  let rollbackConfirmed = false;
  let uploadedPath: string | null = null;

  try {
    await client.query('begin');
    transactionStarted = true;
    const scopeResult = await client.query(
      `
        select
          request_record.id,
          request_record.request_number,
          request_record.voided_at,
          offer.id as offer_version_id
        from quote_requests request_record
        join quote_offer_versions offer
          on offer.quote_request_id = request_record.id
        where request_record.id = $1
          and offer.id = $2
        for update of request_record, offer
      `,
      [quoteRequestId, offerVersionId]
    );
    const scope = scopeResult.rows[0] as
      | {
          request_number: string;
          voided_at: string | null;
          offer_version_id: string | number;
        }
      | undefined;
    if (!scope) {
      throw new ManualUploadError(
        404,
        'QUOTE_MANUAL_DOCUMENT_SCOPE_MISMATCH',
        'Povpraševanje ali izbrana različica ponudbe ne obstaja.'
      );
    }
    if (scope.voided_at) {
      throw new ManualUploadError(
        409,
        'QUOTE_REQUEST_VOIDED',
        'Na odstranjeno povpraševanje dokumenta ni mogoče naložiti.'
      );
    }

    const versionResult = await client.query(
      `
        select coalesce(max(version_number), 0)::integer + 1 as next_version
        from quote_manual_documents
        where quote_request_id = $1
          and document_type = $2
      `,
      [quoteRequestId, documentType]
    );
    const versionNumber = Number(versionResult.rows[0]?.next_version ?? 1);
    const documentNumber = manualDocumentNumber(
      String(scope.request_number),
      documentType,
      versionNumber
    );
    const storageId = randomUUID();
    const blob = await uploadPrivateOrderDocumentBlob(
      buildQuoteDocumentBlobPath(storageId, 'pdf'),
      bytes,
      PDF_CONTENT_TYPE
    );
    uploadedPath = blob.pathname;

    const insertResult = await client.query(
      `
        insert into quote_manual_documents (
          quote_request_id,
          quote_offer_version_id,
          document_type,
          storage_id,
          filename,
          blob_pathname,
          version_number,
          document_number,
          uploaded_at,
          content_sha256,
          mime_type,
          byte_size,
          created_by_actor_type,
          created_by_actor_id
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, now(), $9,
          'application/pdf', $10, 'admin', $11
        )
        returning id, uploaded_at, created_at
      `,
      [
        quoteRequestId,
        offerVersionId,
        documentType,
        storageId,
        filename,
        blob.pathname,
        versionNumber,
        documentNumber,
        contentSha256,
        bytes.length,
        evidence.actorId
      ]
    );
    const inserted = insertResult.rows[0] as {
      id: string | number;
      uploaded_at: string | Date;
      created_at: string | Date;
    };
    const documentId = Number(inserted.id);

    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId: offerVersionId,
      eventKey: `admin-document-uploaded:${documentId}`,
      eventType: 'admin_document_uploaded',
      actorType: 'admin',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        documentId,
        documentType,
        source: 'manual_upload',
        contentSha256,
        byteSize: bytes.length,
        mimeType: PDF_CONTENT_TYPE
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(scope.request_number),
      action: 'updated',
      summary: `Povpraševanje ${scope.request_number}: dokument naložen`,
      metadata: {
        document_id: documentId,
        document_type: documentType,
        offer_version_id: offerVersionId,
        source: 'manual_upload',
        content_sha256: contentSha256,
        byte_size: bytes.length,
        mime_type: PDF_CONTENT_TYPE
      }
    });

    commitAttempted = true;
    await client.query('commit');
    transactionStarted = false;
    uploadedPath = null;
    try {
      revalidateAdminQuotePaths(quoteRequestId);
    } catch (revalidationError) {
      console.error('[quotes.documents.manual-upload] revalidation failed', {
        quoteRequestId,
        message:
          revalidationError instanceof Error
            ? revalidationError.message
            : 'Unknown error'
      });
    }

    return NextResponse.json(
      {
        message:
          documentType === 'offer'
            ? 'PDF ponudbe je naložen.'
            : 'Naročilnica je naložena.',
        created: true,
        document: {
          id: documentId,
          offerVersionId,
          documentType,
          filename,
          documentNumber,
          issuedAt: null,
          contentSha256,
          offerContentHash: null,
          createdAt: new Date(inserted.created_at).toISOString(),
          source: 'manual_upload',
          byteSize: bytes.length,
          mimeType: PDF_CONTENT_TYPE,
          url: `/api/admin/quote-requests/${quoteRequestId}/documents/${documentId}`
        }
      },
      { status: 201, headers: privateHeaders }
    );
  } catch (error) {
    if (transactionStarted) {
      rollbackConfirmed = await client
        .query('rollback')
        .then(() => true)
        .catch(() => false);
    }
    if (transactionStarted && !clientReleased) {
      if (rollbackConfirmed) {
        client.release();
      } else {
        client.release(
          error instanceof Error
            ? error
            : new Error('Manual quote document transaction failed')
        );
      }
      clientReleased = true;
    }

    if (uploadedPath) {
      let referenced: boolean | null = null;
      try {
        const referenceResult = await pool.query(
          `
            select (
              exists (
                select 1 from quote_documents where blob_pathname = $1
              )
              or exists (
                select 1 from quote_manual_documents where blob_pathname = $1
              )
              or exists (
                select 1 from order_documents where blob_pathname = $1
              )
            ) as referenced
          `,
          [uploadedPath]
        );
        referenced = referenceResult.rows[0]?.referenced === true;
      } catch (referenceError) {
        console.error('[quotes.documents.manual-upload] blob reference check failed', {
          pathname: uploadedPath,
          message:
            referenceError instanceof Error
              ? referenceError.message
              : 'Unknown error'
        });
      }
      const safeToDelete = rollbackConfirmed && referenced === false;
      if (safeToDelete) {
        await deletePrivateOrderDocumentBlob(uploadedPath).catch(() => undefined);
      } else {
        console.error('[quotes.documents.manual-upload] retained blob after ambiguous failure', {
          pathname: uploadedPath,
          rollbackConfirmed,
          commitAttempted,
          referenced
        });
      }
    }

    if (error instanceof ManualUploadError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status, headers: privateHeaders }
      );
    }
    console.error('[quotes.documents.manual-upload] failed', {
      quoteRequestId,
      offerVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        code: 'QUOTE_MANUAL_DOCUMENT_INVALID_REQUEST',
        message: 'Dokumenta trenutno ni mogoče naložiti.'
      },
      { status: 500, headers: privateHeaders }
    );
  } finally {
    if (!clientReleased) client.release();
  }
}