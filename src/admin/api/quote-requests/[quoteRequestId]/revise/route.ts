import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import {
  appendQuoteEvent,
  expectedVersion,
  hasValidQuoteAdminSession,
  lockPendingQuotePurchaseOrder,
  mirrorQuoteAdminAudit,
  positiveInteger,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const REVISABLE_OFFER_STATUSES = new Set(['issued', 'withdrawn', 'expired']);

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
  const { quoteRequestId: rawQuoteRequestId } = await props.params;
  const quoteRequestId = positiveInteger(rawQuoteRequestId);
  if (!quoteRequestId) {
    return NextResponse.json({ message: 'Neveljaven ID povpraševanja.' }, { status: 400 });
  }
  const parsed = await readRequiredJsonRecord(request);
  if (!parsed.ok) return parsed.response;
  const sourceOfferVersionId = positiveInteger(parsed.body.offerVersionId);
  const expectedStateVersion = expectedVersion(parsed.body.expectedStateVersion);
  const expectedRequestStateVersion = expectedVersion(
    parsed.body.expectedRequestStateVersion
  );
  if (!sourceOfferVersionId || !expectedStateVersion) {
    return NextResponse.json(
      { message: 'Manjka veljavna izvorna različica ponudbe.' },
      { status: 400 }
    );
  }

  const evidence = await quoteAdminEvidence(request);
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await lockQuoteWorkflow(client, quoteRequestId);
    const requestResult = await client.query(
      `select request_number, status, state_version, voided_at from quote_requests where id = $1 for update`,
      [quoteRequestId]
    );
    const quoteRequest = requestResult.rows[0];
    if (!quoteRequest) {
      await client.query('rollback');
      return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
    }
    if (quoteRequest.voided_at) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_VOIDED',
          message: 'Povpraševanje je odstranjeno in ga ni več mogoče spreminjati.'
        },
        { status: 409 }
      );
    }
    if (
      expectedRequestStateVersion &&
      Number(quoteRequest.state_version) !== expectedRequestStateVersion
    ) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_REQUEST_CONFLICT',
          message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
        },
        { status: 409 }
      );
    }
    if (
      ['accepted', 'declined', 'converted_to_order', 'closed_without_offer'].includes(
        String(quoteRequest.status)
      )
    ) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Iz zaključenega povpraševanja ni mogoče pripraviti nove ponudbe.' },
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
    const existingDraft = await client.query(
      `
        select id, version_number
        from quote_offer_versions
        where quote_request_id = $1 and status = 'draft'
        for update
      `,
      [quoteRequestId]
    );
    if (existingDraft.rowCount) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_DRAFT_EXISTS',
          message: 'Za povpraševanje že obstaja osnutek nove različice.',
          quoteOfferVersionId: Number(existingDraft.rows[0].id)
        },
        { status: 409 }
      );
    }
    const sourceResult = await client.query(
      `
        select *
        from quote_offer_versions
        where id = $1 and quote_request_id = $2
        for update
      `,
      [sourceOfferVersionId, quoteRequestId]
    );
    const source = sourceResult.rows[0];
    if (!source || !REVISABLE_OFFER_STATUSES.has(String(source.status))) {
      await client.query('rollback');
      return NextResponse.json(
        { message: 'Novo različico je mogoče pripraviti iz izdane, umaknjene ali potekle ponudbe.' },
        { status: 409 }
      );
    }
    if (Number(source.state_version) !== expectedStateVersion) {
      await client.query('rollback');
      return NextResponse.json(
        {
          code: 'QUOTE_VERSION_CONFLICT',
          message: 'Ponudba je bila medtem spremenjena. Osvežite stran.'
        },
        { status: 409 }
      );
    }

    const versionResult = await client.query(
      `select coalesce(max(version_number), 0)::int + 1 as next_version from quote_offer_versions where quote_request_id = $1`,
      [quoteRequestId]
    );
    const nextVersion = Number(versionResult.rows[0]?.next_version);
    const createdResult = await client.query(
      `
        insert into quote_offer_versions (
          quote_request_id,
          version_number,
          status,
          is_current,
          customer_snapshot_json,
          billing_snapshot_json,
          seller_message,
          customer_visible_notes,
          admin_notes,
          delivery_terms,
          payment_terms,
          acceptance_method,
          subtotal,
          tax,
          shipping,
          total,
          currency,
          tax_rate,
          shipping_snapshot_json,
          terms_text,
          terms_version,
          valid_until,
          created_by_actor_type,
          created_by_actor_id
        )
        values (
          $1, $2, 'draft', false, $3::jsonb, $4::jsonb, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
          $18, $19, now() + interval '1 month', 'admin', $20
        )
        returning id, state_version, created_at, valid_until
      `,
      [
        quoteRequestId,
        nextVersion,
        JSON.stringify(source.customer_snapshot_json),
        JSON.stringify(source.billing_snapshot_json),
        source.seller_message,
        source.customer_visible_notes,
        source.admin_notes,
        source.delivery_terms,
        source.payment_terms,
        source.acceptance_method,
        source.subtotal,
        source.tax,
        source.shipping,
        source.total,
        source.currency,
        source.tax_rate,
        JSON.stringify(source.shipping_snapshot_json),
        source.terms_text,
        source.terms_version,
        evidence.actorId
      ]
    );
    const created = createdResult.rows[0];
    const newOfferVersionId = Number(created.id);
    await client.query(
      `
        insert into quote_offer_version_items (
          quote_offer_version_id,
          line_number,
          catalog_item_id,
          catalog_variant_id,
          product_slug,
          product_name,
          variant_name,
          sku,
          unit,
          quantity,
          min_order,
          available_stock_at_request,
          category_id,
          category_path,
          selected_attributes,
          image_url,
          base_unit_net,
          discount_pct,
          unit_net,
          unit_tax,
          unit_gross,
          line_net,
          line_tax,
          line_gross,
          tax_rate,
          currency,
          snapshot_json
        )
        select
          $2,
          line_number,
          catalog_item_id,
          catalog_variant_id,
          product_slug,
          product_name,
          variant_name,
          sku,
          unit,
          quantity,
          min_order,
          available_stock_at_request,
          category_id,
          category_path,
          selected_attributes,
          image_url,
          base_unit_net,
          discount_pct,
          unit_net,
          unit_tax,
          unit_gross,
          line_net,
          line_tax,
          line_gross,
          tax_rate,
          currency,
          snapshot_json
        from quote_offer_version_items
        where quote_offer_version_id = $1
        order by line_number
      `,
      [sourceOfferVersionId, newOfferVersionId]
    );
    const previousRequestStatus = String(quoteRequest.status);
    await client.query(
      `
        update quote_requests
        set status = 'in_preparation',
            closed_at = null,
            closed_by_actor_type = null,
            closed_by_actor_id = null,
            closure_reason = null,
            state_version = state_version + 1,
            updated_at = now()
        where id = $1
      `,
      [quoteRequestId]
    );
    await appendQuoteEvent(client, {
      quoteRequestId,
      quoteOfferVersionId: newOfferVersionId,
      eventKey: `draft-created:${newOfferVersionId}`,
      eventType: 'draft_created',
      actorId: evidence.actorId,
      requestId: evidence.requestId,
      metadata: {
        versionNumber: nextVersion,
        revisedFromOfferVersionId: sourceOfferVersionId,
        revisedFromOfferNumber: source.offer_number,
        sourceStatus: source.status,
        sourceRemainsImmutable: true,
        sourceRemainsCurrentUntilIssue: source.status === 'issued'
      }
    });
    await mirrorQuoteAdminAudit(request, client, {
      quoteRequestId,
      requestNumber: String(quoteRequest.request_number),
      action: 'updated',
      summary: `Povpraševanje ${quoteRequest.request_number}: pripravljen osnutek V${nextVersion}`,
      beforeStatus: previousRequestStatus,
      afterStatus: 'in_preparation',
      metadata: {
        quote_offer_version_id: newOfferVersionId,
        source_quote_offer_version_id: sourceOfferVersionId,
        version_number: nextVersion
      }
    });
    await client.query('commit');
    return NextResponse.json(
      {
        quoteOfferVersionId: newOfferVersionId,
        versionNumber: nextVersion,
        stateVersion: Number(created.state_version),
        validUntil: new Date(String(created.valid_until)).toISOString(),
        status: 'draft',
        sourceOfferVersionId,
        sourceStatus: source.status
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    console.error('[quotes.revise] failed', {
      quoteRequestId,
      sourceOfferVersionId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { message: 'Nove različice ponudbe ni mogoče pripraviti.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
