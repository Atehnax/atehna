import { NextResponse } from 'next/server';
import {
  normalizeOrderEmailPdfDocumentReference,
  type OrderEmailPdfDocumentReference
} from '@/shared/domain/emailPdfAttachment';
import type { OrderEmailEventType } from '@/shared/domain/order/orderEmailSettings';
import { requireOrderCustomerEmailConfirmation } from '@/shared/server/adminCustomerEmailConfirmation';
import { getPool } from '@/shared/server/db';
import {
  enqueueOrderEmailEvent,
  scheduleOrderEmailJobs
} from '@/shared/server/orderEmailJobs';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

type SendableDocumentType = 'predracun' | 'invoice';

const eventByDocumentType: Record<SendableDocumentType, OrderEmailEventType> = {
  predracun: 'predracun_issued',
  invoice: 'invoice_issued'
};

const labelByDocumentType: Record<SendableDocumentType, string> = {
  predracun: 'Predračun',
  invoice: 'Račun'
};

function isSendableDocumentType(value: unknown): value is SendableDocumentType {
  return value === 'predracun' || value === 'invoice';
}

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string; documentId: string }> }
) {
  const bodyResult = await readRequiredJsonRecord(request);
  if (!bodyResult.ok) return bodyResult.response;

  const params = await props.params;
  const orderId = Number(params.orderId);
  const documentId = Number(params.documentId);
  if (
    !Number.isSafeInteger(orderId) ||
    orderId <= 0 ||
    !Number.isSafeInteger(documentId) ||
    documentId <= 0
  ) {
    return NextResponse.json(
      { message: 'Naročilo ali dokument ni veljaven.' },
      { status: 400 }
    );
  }

  const pool = await getPool();
  const client = await pool.connect();
  let shouldSchedule = false;
  try {
    await client.query('begin');
    const result = await client.query(
      `
        select
          document.id,
          document.type,
          document.filename,
          document.version_number,
          document.content_sha256,
          document.order_pricing_revision,
          document.order_delivery_plan_revision,
          document.legal_status,
          document.format_marker,
          order_record.order_number,
          order_record.email,
          order_record.pricing_revision,
          order_record.delivery_plan_revision,
          order_record.contract_status,
          order_record.is_draft,
          order_record.deleted_at
        from order_documents document
        join orders order_record on order_record.id = document.order_id
        where document.id = $2
          and document.order_id = $1
          and document.deleted_at is null
        for share of document, order_record
      `,
      [orderId, documentId]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Dokument ne obstaja ali je bil izbrisan.' },
        { status: 404 }
      );
    }
    if (!isSendableDocumentType(row.type)) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Po e-pošti lahko pošljete predračun ali račun.' },
        { status: 409 }
      );
    }
    if (
      row.is_draft !== false ||
      row.deleted_at !== null ||
      row.contract_status !== 'accepted'
    ) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Dokument je mogoče poslati samo za sprejeto naročilo.' },
        { status: 409 }
      );
    }
    if (
      row.legal_status !== 'operational' ||
      row.format_marker !== 'atehna-template-pdf-v3' ||
      Number(row.order_pricing_revision) !== Number(row.pricing_revision) ||
      Number(row.order_delivery_plan_revision) !==
        Number(row.delivery_plan_revision)
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          message:
            'Dokument ne ustreza trenutni različici naročila. Najprej ustvarite novo različico.'
        },
        { status: 409 }
      );
    }

    const recipientEmail = String(row.email ?? '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(recipientEmail) || recipientEmail.length > 320) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Naročilo nima veljavnega e-poštnega naslova stranke.' },
        { status: 409 }
      );
    }

    await client.query(
      `select key
       from order_email_settings
       where key = 'order-email-notifications'
       for share`
    );
    const eventType = eventByDocumentType[row.type];
    const settings = await getOrderEmailSettings(client);
    if (!settings.enabled || settings.events[eventType]?.customer !== true) {
      await client.query('rollback');
      return NextResponse.json(
        {
          message: `V nastavitvah e-pošte najprej vključite pošiljanje dogodka »${labelByDocumentType[row.type]} poslan« stranki.`
        },
        { status: 409 }
      );
    }

    const actionLabel = `Pošiljanje dokumenta »${String(row.filename)}«`;
    const confirmationChallenge =
      await requireOrderCustomerEmailConfirmation({
        client,
        orderId,
        eventType,
        action: `send_order_document:${documentId}`,
        actionLabel,
        customerEmailConfirmationToken:
          bodyResult.body.customerEmailConfirmationToken,
        recipientEmail
      });
    if (confirmationChallenge) {
      await client.query('rollback');
      return NextResponse.json(confirmationChallenge, { status: 428 });
    }

    const pdfDocument = normalizeOrderEmailPdfDocumentReference({
      source: 'order_document',
      orderId,
      documentType: row.type,
      versionNumber: Number(row.version_number),
      documentId,
      contentSha256: row.content_sha256,
      filename: row.filename
    }) as OrderEmailPdfDocumentReference | null;
    if (!pdfDocument) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Podatki PDF dokumenta niso veljavni za pošiljanje.' },
        { status: 409 }
      );
    }

    const eventKey = `order-document-email:${row.type}:${documentId}`;
    const insertedJobIds = await enqueueOrderEmailEvent(client, {
      orderId,
      eventKey,
      eventType,
      occurredAt: new Date().toISOString(),
      previousStatus: null,
      pdfDocument
    });
    const queuedResult = await client.query(
      `select status
       from order_email_jobs
       where event_key = $1
         and audience = 'customer'
         and lower(recipient_email) = lower($2)
       limit 1`,
      [eventKey, recipientEmail]
    );
    const status = String(queuedResult.rows[0]?.status ?? '');
    if (!status) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'E-poštnega opravila ni bilo mogoče ustvariti.' },
        { status: 409 }
      );
    }
    await client.query('commit');
    shouldSchedule = status === 'pending' || status === 'processing';
    if (shouldSchedule) scheduleOrderEmailJobs(pool, orderId);

    const label = labelByDocumentType[row.type];
    return NextResponse.json(
      {
        queued: insertedJobIds.length > 0,
        status,
        message:
          insertedJobIds.length > 0
            ? `${label} je uvrščen za pošiljanje stranki.`
            : status === 'sent'
              ? `${label} je bil tej stranki že poslan.`
              : status === 'failed'
                ? `${label} ima neuspešno e-poštno opravilo. Ponovite ga na strani Email.`
                : `${label} že čaka na pošiljanje.`
      },
      { status: status === 'failed' ? 409 : 200 }
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[orders.document-email] failed', {
      orderId,
      documentId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Pošiljanje dokumenta ni uspelo.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
