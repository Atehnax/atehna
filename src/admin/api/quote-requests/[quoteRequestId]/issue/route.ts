import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import {
  buildQuoteOfferReviewUrl,
  issueQuoteAccessToken,
  lockQuoteWorkflow,
  revokeQuoteAccessForOffer
} from '@/shared/server/quoteAccess';
import { quoteContentSha256 } from '@/shared/server/quoteContentHash';
import {
  renderQuoteOfferPdf,
  scheduleQuoteDocumentJobs
} from '@/shared/server/quoteDocumentJobs';
import {
  enqueueQuoteEmailEvent,
  scheduleQuoteEmailJobs
} from '@/shared/server/quoteEmailJobs';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { getOrderEmailSettings } from '@/shared/server/orderEmailSettings';
import { requireQuoteCustomerEmailConfirmation } from '@/shared/server/adminCustomerEmailConfirmation';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  hasValidQuoteAdminSession,
  lockPendingQuotePurchaseOrder,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const POSTAL_CODE_PATTERN = /^\d{4}$/u;
const ADMIN_DRAFT_CONTACT_NAME = 'Osnutek';
const ADMIN_DRAFT_EMAIL = 'draft@atehna.si';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function text(value: unknown, maximum: number): string {
  const normalized =
    typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (normalized.length > maximum) throw new Error('Vrednost polja je predolga.');
  return normalized;
}

function iso(value: unknown): string {
  const parsed = new Date(String(value ?? ''));
  if (Number.isNaN(parsed.getTime())) throw new Error('Datum veljavnosti ni veljaven.');
  return parsed.toISOString();
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalIssueText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function canonicalIssueInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}


function issuePayloadFingerprint(
  quoteRequestId: number,
  body: Record<string, unknown>
): string {
  const identity = {
    schemaVersion: 1,
    quoteRequestId,
    offerVersionId: canonicalIssueInteger(body.offerVersionId),
    expectedStateVersion: canonicalIssueInteger(body.expectedStateVersion),
    expectedRequestStateVersion: canonicalIssueInteger(
      body.expectedRequestStateVersion
    ),
    validUntil: canonicalIssueText(body.validUntil),
    termsText: canonicalIssueText(body.termsText),
    termsVersion: canonicalIssueText(body.termsVersion),
    freeShippingConfirmed: body.freeShippingConfirmed === true,
    shippingReason: canonicalIssueText(body.shippingReason)
  };
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

export async function POST(
  request: Request,
  props: { params: Promise<{ quoteRequestId: string }> }
) {
  if (!isQuoteAdminEnabled()) {
    return NextResponse.json({ message: 'Ponudbe niso omogočene.' }, { status: 404 });
  }
  if (!hasValidQuoteAdminSession(request)) {
    return NextResponse.json({ message: 'Za dostop je potrebna prijava.' }, { status: 401 });
  }
  const { quoteRequestId: rawId } = await props.params;
  const quoteRequestId = Number(rawId);
  if (!Number.isSafeInteger(quoteRequestId) || quoteRequestId <= 0) {
    return NextResponse.json({ message: 'Neveljaven ID povpraševanja.' }, { status: 400 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const actionId = typeof parsed.body.actionId === 'string'
    ? parsed.body.actionId.trim().toLowerCase()
    : '';
  if (!UUID_PATTERN.test(actionId)) {
    return NextResponse.json(
      { message: 'Neveljaven identifikator izdaje ponudbe.' },
      { status: 400 }
    );
  }
  const payloadFingerprint = issuePayloadFingerprint(quoteRequestId, parsed.body);
  const evidence = await quoteAdminEvidence(request);

  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      'select * from quote_requests where id = $1 for update',
      [quoteRequestId]
    );
    const quoteRequest = requestResult.rows[0];
    if (!quoteRequest) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }

    const existingIssueResult = await client.query(
      `
        select
          event.quote_offer_version_id,
          event.metadata_json,
          offer.offer_number,
          offer.version_number,
          offer.valid_until,
          offer.content_hash,
          offer.terms_hash,
          document_job.status as document_status,
          exists (
            select 1
            from quote_email_jobs email_job
            where email_job.quote_request_id = event.quote_request_id
              and email_job.quote_offer_version_id = event.quote_offer_version_id
              and email_job.event_key =
                'quote-issued:' || event.quote_offer_version_id::text
          ) as email_queued
        from quote_events event
        join quote_offer_versions offer
          on offer.id = event.quote_offer_version_id
         and offer.quote_request_id = event.quote_request_id
        left join lateral (
          select job.status
          from quote_document_jobs job
          where job.quote_offer_version_id = event.quote_offer_version_id
            and job.document_type = 'offer'
          limit 1
        ) document_job on true
        where event.quote_request_id = $1
          and event.event_type = 'offer_issued'
          and event.metadata_json ->> 'actionId' = $2
        order by event.id
        limit 1
      `,
      [quoteRequestId, actionId]
    );
    const existingIssue = existingIssueResult.rows[0];
    if (existingIssue) {
      const metadata = jsonRecord(existingIssue.metadata_json);
      if (metadata.issuePayloadFingerprint !== payloadFingerprint) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_ISSUE_IDEMPOTENCY_CONFLICT',
            message: 'Ta izdaja je bila že izvedena z drugačnimi podatki.'
          },
          { status: 409 }
        );
      }

      await client.query('commit');
      return NextResponse.json({
        actionId,
        replayed: true,
        quoteOfferVersionId: Number(existingIssue.quote_offer_version_id),
        requestNumber: quoteRequest.request_number,
        offerNumber: String(existingIssue.offer_number),
        versionNumber: Number(existingIssue.version_number),
        status: 'issued',
        validUntil: iso(existingIssue.valid_until),
        contentHash: String(existingIssue.content_hash),
        termsHash: String(existingIssue.terms_hash),
        documentStatus:
          typeof existingIssue.document_status === 'string'
            ? existingIssue.document_status
            : 'missing',
        emailQueued: existingIssue.email_queued === true
      });
    }

    if (quoteRequest.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in ponudbe ni več mogoče izdati.'
        },
        { status: 409 }
      );
    }
    if (
      Number(parsed.body.expectedRequestStateVersion) !==
      Number(quoteRequest.state_version)
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_STALE',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    if (
      ['accepted', 'declined', 'expired', 'withdrawn', 'converted_to_order', 'closed_without_offer'].includes(
        String(quoteRequest.status)
      )
    ) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Zaključenega povpraševanja ni mogoče izdati.' },
        { status: 409 }
      );
    }
    const pendingPurchaseOrder = await lockPendingQuotePurchaseOrder(
      client,
      quoteRequestId
    );
    if (pendingPurchaseOrder) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'PURCHASE_ORDER_REVIEW_REQUIRED',
          message: `Naročilo ${pendingPurchaseOrder.orderNumber} najprej potrdite ali zavrnite v pregledu naročilnice.`
        },
        { status: 409 }
      );
    }
    const draftResult = await client.query(
      `
        select *
        from quote_offer_versions
        where quote_request_id = $1 and status = 'draft'
        order by version_number desc
        limit 1
        for update
      `,
      [quoteRequestId]
    );
    const draft = draftResult.rows[0];
    if (!draft) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Najprej pripravite osnutek ponudbe.' },
        { status: 409 }
      );
    }
    if (
      Number(parsed.body.offerVersionId) !== Number(draft.id) ||
      Number(parsed.body.expectedStateVersion) !== Number(draft.state_version)
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_DRAFT_STALE',
          message: 'Osnutek je bil medtem spremenjen. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    const draftCustomer = jsonRecord(draft.customer_snapshot_json);
    const snapshotValue = (key: string, requestKey: string) =>
      Object.prototype.hasOwnProperty.call(draftCustomer, key)
        ? draftCustomer[key]
        : quoteRequest[requestKey];
    const customerType = text(snapshotValue('customerType', 'customer_type'), 32);
    const organizationName = text(
      snapshotValue('organizationName', 'organization_name'),
      240
    );
    const contactName = text(snapshotValue('contactName', 'contact_name'), 240);
    const email = text(snapshotValue('email', 'email'), 320).toLowerCase();
    const addressLine1 = text(
      snapshotValue('addressLine1', 'address_line1'),
      300
    );
    const addressLine2 =
      text(snapshotValue('addressLine2', 'address_line2'), 500) || null;
    const postalCode = text(snapshotValue('postalCode', 'postal_code'), 16);
    const city = text(snapshotValue('city', 'city'), 160);
    const countryCode = text(
      snapshotValue('countryCode', 'country_code'),
      2
    ).toUpperCase();
    const gursHouseNumberId =
      text(snapshotValue('gursHouseNumberId', 'gurs_house_number_id'), 120) || null;
    const reference =
      text(snapshotValue('reference', 'reference'), 240) || null;
    const quoteReason =
      text(snapshotValue('quoteReason', 'quote_reason'), 80) || null;
    const customerMessage =
      text(snapshotValue('customerMessage', 'customer_message'), 8_000) || null;
    const customerDetailsComplete =
      Boolean(contactName)
      && EMAIL_PATTERN.test(email)
      && contactName !== ADMIN_DRAFT_CONTACT_NAME
      && email !== ADMIN_DRAFT_EMAIL
      && (
        customerType === 'individual'
        || (Boolean(organizationName) && organizationName !== ADMIN_DRAFT_CONTACT_NAME)
      )
      && Boolean(addressLine1)
      && POSTAL_CODE_PATTERN.test(postalCode)
      && Boolean(city)
      && countryCode === 'SI';
    if (!customerDetailsComplete) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_CUSTOMER_DETAILS_INCOMPLETE',
          message:
            'Pred izdajo dopolnite identiteto, e-pošto in celoten naslov stranke.'
        },
        { status: 409 }
      );
    }
    if (parsed.body.confirmationOnly === true) {
      const confirmationChallenge =
        await requireQuoteCustomerEmailConfirmation({
          client,
          quoteRequestId,
          eventType: 'quote_issued',
          action: 'issue_quote',
          actionLabel: 'Izdaja ponudbe',
          customerEmailConfirmationToken:
            parsed.body.customerEmailConfirmationToken,
          recipientEmail: email
        });
      await client.query('rollback');
      if (confirmationChallenge) {
        return NextResponse.json(confirmationChallenge, { status: 428 });
      }
      return NextResponse.json({ confirmationRequired: false });
    }
    const acceptanceMethod =
      customerType === 'school' ? 'purchase_order' : 'online';
    if (draft.acceptance_method !== acceptanceMethod) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_ACCEPTANCE_METHOD_INVALID',
          message:
            'Način sprejema osnutka ni veljaven za vrsto stranke. Osnutek shranite z ustreznim načinom sprejema in poskusite znova.'
        },
        { status: 409 }
      );
    }
    const itemsResult = await client.query(
      `
        select *
        from quote_offer_version_items
        where quote_offer_version_id = $1
        order by line_number
      `,
      [draft.id]
    );
    if (itemsResult.rowCount === 0) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Ponudba mora vsebovati vsaj eno postavko.' },
        { status: 409 }
      );
    }
    const deliveryTerms = text(draft.delivery_terms, 4_000);
    const paymentTerms = text(draft.payment_terms, 4_000);
    const termsText = text(
      parsed.body.termsText ?? draft.terms_text,
      20_000
    );
    const termsVersion = text(
      parsed.body.termsVersion ?? draft.terms_version,
      120
    );
    if (!deliveryTerms || !paymentTerms || !termsVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          message:
            'Pred izdajo vnesite dobavne in plačilne pogoje.'
        },
        { status: 409 }
      );
    }
    const issuedAt = new Date();
    const validUntil = iso(parsed.body.validUntil ?? draft.valid_until);
    if (new Date(validUntil).getTime() <= issuedAt.getTime()) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Datum veljavnosti mora biti v prihodnosti.' },
        { status: 400 }
      );
    }
    const shipping = Number(draft.shipping);
    const savedShippingConfirmation = jsonRecord(
      draft.shipping_confirmation_json
    );
    const freeShippingConfirmed =
      parsed.body.freeShippingConfirmed === true ||
      (savedShippingConfirmation.decision === 'free_shipping' &&
        savedShippingConfirmation.confirmed === true);
    if (shipping === 0 && !freeShippingConfirmed) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'FREE_SHIPPING_CONFIRMATION_REQUIRED',
          message: 'Brezplačno dostavo morate pred izdajo izrecno potrditi.'
        },
        { status: 409 }
      );
    }
    const shippingConfirmation = {
      ...savedShippingConfirmation,
      decision: shipping === 0 ? 'free_shipping' : 'explicit_amount',
      confirmed: true,
      confirmed_at: issuedAt.toISOString(),
      confirmed_by_actor_type: 'admin',
      amount: shipping,
      reason:
        text(parsed.body.shippingReason, 1_000) ||
        (shipping === 0
          ? 'Administrator je izrecno potrdil brezplačno dostavo.'
          : 'Administrator je potrdil znesek dostave v ponudbi.')
    };
    const numberMatch = /^POV-([0-9]{4})-([0-9]{6})$/u.exec(
      String(quoteRequest.request_number)
    );
    if (!numberMatch) throw new Error('Številka povpraševanja ni veljavna.');
    const versionNumber = Number(draft.version_number);
    const offerNumber =
      `PON-${numberMatch[1]}-${numberMatch[2]}-V${versionNumber}`;
    const contentSnapshot = {
      schemaVersion: 1,
      requestNumber: quoteRequest.request_number,
      offerNumber,
      versionNumber,
      issuedAt: issuedAt.toISOString(),
      validUntil,
      customer: draft.customer_snapshot_json,
      billing: draft.billing_snapshot_json,
      sellerMessage: draft.seller_message,
      customerVisibleNotes: draft.customer_visible_notes,
      deliveryTerms,
      paymentTerms,
      acceptanceMethod: draft.acceptance_method,
      totals: {
        subtotal: String(draft.subtotal),
        tax: String(draft.tax),
        shipping: String(draft.shipping),
        total: String(draft.total),
        currency: draft.currency,
        taxRate: String(draft.tax_rate)
      },
      shippingSnapshot: draft.shipping_snapshot_json,
      shippingConfirmation,
      terms: { version: termsVersion, text: termsText },
      items: itemsResult.rows.map((item) => ({
        lineNumber: Number(item.line_number),
        catalogItemId: item.catalog_item_id === null ? null : Number(item.catalog_item_id),
        catalogVariantId:
          item.catalog_variant_id === null ? null : Number(item.catalog_variant_id),
        productSlug: item.product_slug,
        productName: item.product_name,
        variantName: item.variant_name,
        sku: item.sku,
        unit: item.unit,
        quantity: Number(item.quantity),
        categoryId: item.category_id,
        categoryPath: item.category_path,
        selectedAttributes: item.selected_attributes,
        imageUrl: item.image_url,
        baseUnitNet: String(item.base_unit_net),
        discountPct: String(item.discount_pct),
        unitNet: String(item.unit_net),
        unitTax: String(item.unit_tax),
        unitGross: String(item.unit_gross),
        lineNet: String(item.line_net),
        lineTax: String(item.line_tax),
        lineGross: String(item.line_gross),
        taxRate: String(item.tax_rate),
        currency: item.currency,
        snapshot: item.snapshot_json
      }))
    };
    const termsHash = quoteContentSha256({
      version: termsVersion,
      text: termsText
    });
    const contentHash = quoteContentSha256(contentSnapshot);

    const confirmationChallenge =
      await requireQuoteCustomerEmailConfirmation({
        client,
        quoteRequestId,
        eventType: 'quote_issued',
        action: 'issue_quote',
        actionLabel: 'Izdaja ponudbe',
        customerEmailConfirmationToken:
          parsed.body.customerEmailConfirmationToken,
        recipientEmail: email
      });
    if (confirmationChallenge) {
      await client.query('rollback');
      return NextResponse.json(confirmationChallenge, { status: 428 });
    }

    const previousIssued = await client.query(
      `
        select id
        from quote_offer_versions
        where quote_request_id = $1
          and status = 'issued'
          and is_current = true
        for update
      `,
      [quoteRequestId]
    );
    for (const previous of previousIssued.rows) {
      await client.query(
        `
          update quote_offer_versions
          set status = 'superseded',
              is_current = false,
              superseded_at = now(),
              state_version = state_version + 1,
              updated_at = now()
          where id = $1
        `,
        [previous.id]
      );
      await revokeQuoteAccessForOffer(client, Number(previous.id));
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key, event_type,
            actor_type, occurred_at, metadata_json
          )
          values ($1, $2, $3, 'offer_superseded', 'admin', now(), $4::jsonb)
        `,
        [
          quoteRequestId,
          previous.id,
          `offer-superseded:${previous.id}`,
          JSON.stringify({ supersededByVersionId: Number(draft.id) })
        ]
      );
    }

    await client.query(
      `
        update quote_requests
        set customer_type = $2,
            organization_name = $3,
            contact_name = $4,
            email = $5,
            address_line1 = $6,
            address_line2 = $7,
            postal_code = $8,
            city = $9,
            country_code = $10,
            gurs_house_number_id = $11,
            reference = $12,
            quote_reason = $13,
            customer_message = $14,
            billing_snapshot_json = $15::jsonb,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [
        quoteRequestId,
        customerType,
        customerType === 'individual' ? null : organizationName,
        contactName,
        email,
        addressLine1 || null,
        addressLine2,
        postalCode || null,
        city || null,
        countryCode,
        gursHouseNumberId,
        reference,
        quoteReason,
        customerMessage,
        JSON.stringify(jsonRecord(draft.billing_snapshot_json))
      ]
    );

    await client.query(
      `
        update quote_offer_versions
        set offer_number = $2,
            status = 'issued',
            is_current = true,
            shipping_confirmation_json = $3::jsonb,
            terms_text = $4,
            terms_version = $5,
            terms_hash = $6,
            content_snapshot_json = $7::jsonb,
            content_hash = $8,
            issued_at = $9,
            valid_until = $10,
            issued_by_actor_type = 'admin',
            issued_by_actor_id = null,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [
        draft.id,
        offerNumber,
        JSON.stringify(shippingConfirmation),
        termsText,
        termsVersion,
        termsHash,
        JSON.stringify(contentSnapshot),
        contentHash,
        issuedAt.toISOString(),
        validUntil
      ]
    );
    await client.query(
      `
        update quote_requests
        set status = 'offer_issued',
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteRequestId]
    );
    const renderedDocument = await renderQuoteOfferPdf(
      client,
      Number(draft.id),
      { mode: 'issued' }
    );
    const renderedPdfBytes = Buffer.from(renderedDocument.bytes);
    const renderedDocumentSha256 = createHash('sha256')
      .update(renderedPdfBytes)
      .digest('hex');
    await client.query(
      `
        insert into quote_document_jobs (
          quote_offer_version_id,
          document_type,
          payload_json
        )
        values ($1, 'offer', $2::jsonb)
        on conflict (quote_offer_version_id, document_type)
        do nothing
      `,
      [
        draft.id,
        JSON.stringify({
          payloadVersion: 1,
          contentHash,
          termsHash,
          offerNumber,
          documentNumber: renderedDocument.documentNumber,
          renderedDocumentSha256,
          renderedPdfBase64: renderedPdfBytes.toString('base64')
        })
      ]
    );
    const access = await issueQuoteAccessToken(client, {
      quoteRequestId,
      quoteOfferVersionId: Number(draft.id),
      scopes: [
        'offer_review',
        'offer_response',
        ...(acceptanceMethod === 'purchase_order'
          ? (['purchase_order'] as const)
          : [])
      ],
      ttlDays: Math.max(
        1,
        Math.ceil((new Date(validUntil).getTime() - issuedAt.getTime()) / 86_400_000) + 7
      )
    });
    await client.query(
      `
        insert into quote_events (
          quote_request_id, quote_offer_version_id, event_key, event_type,
          actor_type, actor_id, occurred_at, request_id, correlation_id,
          metadata_json
        )
        values (
          $1, $2, $3, 'offer_issued', 'admin', $4, $5, $6, $7, $8::jsonb
        )
      `,
      [
        quoteRequestId,
        draft.id,
        `offer-issued:${draft.id}`,
        evidence.actorId,
        issuedAt.toISOString(),
        evidence.requestId,
        actionId,
        JSON.stringify({
          actionId,
          issuePayloadFingerprint: payloadFingerprint,
          offerNumber,
          versionNumber,
          contentHash,
          termsHash,
          validUntil,
          stockReserved: false
        })
      ]
    );
    if (previousIssued.rowCount && previousIssued.rowCount > 0) {
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key, event_type,
            actor_type, occurred_at, metadata_json
          )
          values ($1, $2, $3, 'new_version_issued', 'admin', $4, $5::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          quoteRequestId,
          draft.id,
          `new-version-issued:${draft.id}`,
          issuedAt.toISOString(),
          JSON.stringify({
            offerNumber,
            versionNumber,
            supersededOfferVersionIds: previousIssued.rows.map((row) => Number(row.id))
          })
        ]
      );
    }

    let quoteEmailQueued = false;
    await client.query('savepoint quote_issue_email');
    try {
      const sharedEmailSettings = await getOrderEmailSettings(client);
      const offerUrl = new URL(
        buildQuoteOfferReviewUrl(access.token),
        sharedEmailSettings.siteUrl
      ).toString();
      const jobs = await enqueueQuoteEmailEvent(client, {
        quoteRequestId,
        quoteOfferVersionId: Number(draft.id),
        eventKey: `quote-issued:${draft.id}`,
        eventType: 'quote_issued',
        offerUrl
      });
      quoteEmailQueued = jobs.length > 0;
      if (quoteEmailQueued) {
        await client.query(
          `
            insert into quote_events (
              quote_request_id, quote_offer_version_id, event_key, event_type,
              actor_type, occurred_at, metadata_json
            )
            values ($1, $2, $3, 'quote_email_queued', 'system', clock_timestamp(), $4::jsonb)
            on conflict (event_key) where event_key is not null do nothing
          `,
          [
            quoteRequestId,
            draft.id,
            `quote-email-queued:${draft.id}`,
            JSON.stringify({ eventType: 'quote_issued', jobCount: jobs.length })
          ]
        );
      }
      await client.query('release savepoint quote_issue_email');
    } catch (error) {
      await client.query('rollback to savepoint quote_issue_email');
      await client.query('release savepoint quote_issue_email');
      await client.query(
        `
          insert into quote_events (
            quote_request_id, quote_offer_version_id, event_key, event_type,
            actor_type, occurred_at, reason, metadata_json
          )
          values ($1, $2, $3, 'quote_email_provider_failed', 'system', clock_timestamp(), $4, $5::jsonb)
          on conflict (event_key) where event_key is not null do nothing
        `,
        [
          quoteRequestId,
          draft.id,
          `quote-email-enqueue-failed:${draft.id}`,
          'E-poštnega opravila ni bilo mogoče varno ustvariti.',
          JSON.stringify({
            stage: 'enqueue',
            message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
          })
        ]
      );
    }
    await client.query('commit');
    scheduleQuoteDocumentJobs(pool);
    if (quoteEmailQueued) scheduleQuoteEmailJobs(pool);
    return NextResponse.json(
      {
        actionId,
        replayed: false,
        quoteOfferVersionId: Number(draft.id),
        requestNumber: quoteRequest.request_number,
        offerNumber,
        versionNumber,
        status: 'issued',
        validUntil,
        contentHash,
        termsHash,
        documentStatus: 'pending',
        emailQueued: quoteEmailQueued
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.issue] failed', {
      quoteRequestId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Ponudbe ni mogoče izdati.'
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
