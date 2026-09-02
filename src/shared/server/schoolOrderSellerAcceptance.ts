import 'server-only';

import type { PoolClient } from 'pg';
import {
  CatalogOrderabilityError,
  isCatalogSerializationFailure,
  lockCatalogOrderability,
  requireLockedCatalogVariantOrderable
} from '@/shared/server/catalogOrderabilityLocks';
import {
  OrderStockConflictError,
  commitOrderStockHolds
} from '@/shared/server/orderStockHolds';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import {
  requireOrderAndQuoteCustomerEmailConfirmation
} from '@/shared/server/adminCustomerEmailConfirmation';
import { enqueueQuoteEmailEvent } from '@/shared/server/quoteEmailJobs';
import { getQuoteStockAcceptanceMode } from '@/shared/server/quoteEmailSettings';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';

const sql = (lines: readonly string[]) => lines.join('\n');

export type LockedSchoolOrderForAcceptance = Readonly<{
  order_number: string;
  customer_type: string;
  commitment_status: string | null;
  contract_status: string | null;
  source_quote_offer_version_id: string | number | null;
  status: string;
  deleted_at: string | null;
  is_draft: boolean;
}>;

export type CurrentPurchaseOrderEvidence = Readonly<{
  id: string | number;
  content_sha256: string | null;
  issued_at: string | Date | null;
}>;

type AcceptanceBlockBody = {
  code?: string;
  message: string;
  variantId?: number;
  requestedQuantity?: number;
  availableStock?: number;
};

export type SchoolOrderSellerAcceptanceResult =
  | {
      ok: true;
      preflightOnly: true;
    }
  | {
      ok: true;
      preflightOnly: false;
      purchaseOrderDocumentId: number;
      quoteEmailQueued: boolean;
      quoteOfferVersionId: number | null;
      quoteRequestId: number | null;
      revokedQuoteAccessTokenCount: number;
      stockFinalizationOutcome:
        | 'deferred_until_draft_finalization'
        | 'committed_or_verified'
        | 'not_required_stock_enforcement_disabled';
    }
  | {
      ok: false;
      status: number;
      body: AcceptanceBlockBody;
      persistConflictOutcome: boolean;
      quoteEmailQueued: boolean;
    };

type SourceQuote = {
  id: number;
  quoteRequestId: number;
  status: string;
  isCurrent: boolean;
  requestStatus: string;
  validUntil: Date;
  termsVersion: string;
  termsHash: string;
  contentHash: string;
  documentSha256: string;
  stockBlocked: boolean;
};

const conflictResult = (
  error: OrderStockConflictError,
  message = error.message
): AcceptanceBlockBody => ({
  code: 'STOCK_CHANGED_REQUIRES_REVISION',
  message,
  variantId: error.variantId,
  requestedQuantity: error.requestedQuantity,
  availableStock: error.availableStock
});

export async function acceptSchoolOrderForProcessing(input: {
  request: Request;
  client: PoolClient;
  orderId: number;
  order: LockedSchoolOrderForAcceptance;
  purchaseOrderDocument: CurrentPurchaseOrderEvidence;
  customerEmailConfirmationToken?: unknown;
  orderRecipientEmail?: unknown;
  confirmationOnly: boolean;
}): Promise<SchoolOrderSellerAcceptanceResult> {
  const { request, client, orderId, order, purchaseOrderDocument } = input;
  const purchaseOrderDocumentId = Number(purchaseOrderDocument.id);
  if (
    !Number.isSafeInteger(purchaseOrderDocumentId) ||
    purchaseOrderDocumentId <= 0
  ) {
    return {
      ok: false,
      status: 409,
      body: {
        code: 'SCHOOL_PURCHASE_ORDER_REQUIRED',
        message:
          'Pred nadaljevanjem naložite veljavno naročilnico za trenutno različico naročila.'
      },
      persistConflictOutcome: false,
      quoteEmailQueued: false
    };
  }

  let sourceQuote: SourceQuote | null = null;
  const stockEnforcementEnabled = await isStockEnforcementEnabled(client);
  const stockAcceptanceMode = await getQuoteStockAcceptanceMode(client);
  let quoteEmailQueued = false;
  let revokedQuoteAccessTokenCount = 0;
  if (order.source_quote_offer_version_id !== null) {
    if (!isQuoteAdminEnabled()) {
      return {
        ok: false,
        status: 404,
        body: {
          code: 'QUOTE_ADMIN_DISABLED',
          message: 'Ponudbe niso omogočene.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }

    const quoteResult = await client.query(
      sql([
        'select',
        '  offer.id,',
        '  offer.quote_request_id,',
        '  offer.offer_number,',
        '  offer.status,',
        '  offer.is_current,',
        '  offer.valid_until,',
        '  offer.terms_version,',
        '  offer.terms_hash,',
        '  offer.content_hash,',
        '  offer.document_sha256,',
        '  exists (',
        '    select 1',
        '    from quote_events blocked_event',
        '    where blocked_event.quote_offer_version_id = offer.id',
        "      and blocked_event.event_type = 'acceptance_blocked_stock'",
        '  ) as stock_blocked,',
        '  quote_request.status as request_status',
        'from quote_offer_versions offer',
        'join quote_requests quote_request',
        '  on quote_request.id = offer.quote_request_id',
        'where offer.id = $1',
        'for update of offer, quote_request'
      ]),
      [order.source_quote_offer_version_id]
    );
    const row = quoteResult.rows[0];
    if (!row) {
      return {
        ok: false,
        status: 409,
        body: { message: 'Izvorna ponudba naročila ne obstaja.' },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }
    sourceQuote = {
      id: Number(row.id),
      quoteRequestId: Number(row.quote_request_id),
      status: String(row.status),
      isCurrent: row.is_current === true,
      requestStatus: String(row.request_status),
      validUntil: new Date(String(row.valid_until)),
      termsVersion: String(row.terms_version),
      termsHash: String(row.terms_hash),
      contentHash: String(row.content_hash),
      documentSha256: String(row.document_sha256),
      stockBlocked: row.stock_blocked === true
    };
    if (
      sourceQuote.status !== 'issued' ||
      !sourceQuote.isCurrent ||
      sourceQuote.requestStatus !== 'awaiting_purchase_order_review'
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'QUOTE_PURCHASE_ORDER_REVIEW_STALE',
          message:
            'Naročilnice ni mogoče potrditi, ker ponudba ni več trenutna izdana različica.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }
    if (!sourceQuote.documentSha256) {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'QUOTE_DOCUMENT_EVIDENCE_MISSING',
          message: 'Ponudba nima vezanega nespremenljivega dokumenta.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }
    if (
      stockEnforcementEnabled &&
      stockAcceptanceMode === 'automatic' &&
      sourceQuote.stockBlocked
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'STOCK_CHANGED_REQUIRES_REVISION',
          message:
            'Zaloga se je spremenila. Naročilnico zavrnite in izdajte novo različico ponudbe.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }

    const purchaseOrderSubmittedAt = new Date(
      String(purchaseOrderDocument.issued_at)
    );
    if (
      Number.isNaN(purchaseOrderSubmittedAt.getTime()) ||
      Number.isNaN(sourceQuote.validUntil.getTime()) ||
      purchaseOrderSubmittedAt.getTime() > sourceQuote.validUntil.getTime()
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'QUOTE_PURCHASE_ORDER_OUTSIDE_VALIDITY',
          message:
            'Naročilnica ni bila oddana v času veljavnosti izvorne ponudbe.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }
  }

  const requireOutcomeConfirmation = async (
    quoteEventType: 'quote_accepted' | 'quote_acceptance_blocked_stock'
  ) => {
    if (!sourceQuote) return null;
    return requireOrderAndQuoteCustomerEmailConfirmation({
      client,
      orderId,
      orderEventType: 'in_progress',
      orderRecipientEmail: input.orderRecipientEmail,
      quoteRequestId: sourceQuote.quoteRequestId,
      quoteEventType,
      action: 'change_order_status',
      actionLabel: 'Sprememba statusa naročila',
      customerEmailConfirmationToken: input.customerEmailConfirmationToken
    });
  };

  let stockFinalizationOutcome:
    | 'deferred_until_draft_finalization'
    | 'committed_or_verified'
    | 'not_required_stock_enforcement_disabled';
  if (order.is_draft) {
    const confirmationChallenge =
      await requireOutcomeConfirmation('quote_accepted');
    if (confirmationChallenge) {
      return {
        ok: false,
        status: 428,
        body: confirmationChallenge,
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }
    if (input.confirmationOnly) return { ok: true, preflightOnly: true };
    stockFinalizationOutcome = 'deferred_until_draft_finalization';
  } else {
    const itemsResult = await client.query(
      sql([
        'select',
        '  catalog_item_id,',
        '  catalog_variant_id,',
        '  sum(quantity)::integer as quantity,',
        '  min(name) as label',
        'from order_items',
        'where order_id = $1',
        'group by catalog_item_id, catalog_variant_id',
        'order by catalog_item_id, catalog_variant_id'
      ]),
      [orderId]
    );
    const items = itemsResult.rows as Array<{
      catalog_item_id: string | number | null;
      catalog_variant_id: string | number | null;
      quantity: string | number;
      label: string | null;
    }>;
    if (
      items.length === 0 ||
      items.some(
        (item) =>
          item.catalog_item_id === null || item.catalog_variant_id === null
      )
    ) {
      return {
        ok: false,
        status: 409,
        body: {
          code: 'ORDER_STOCK_LINKS_INCOMPLETE',
          message:
            'Naročilo nima popolnih povezav na različice in ga ni mogoče varno potrditi.'
        },
        persistConflictOutcome: false,
        quoteEmailQueued: false
      };
    }

    await client.query('savepoint school_stock_commit');
    try {
      const lockedVariants = await lockCatalogOrderability(
        client,
        items.map((item) => Number(item.catalog_variant_id))
      );
      for (const item of items) {
        const variantId = Number(item.catalog_variant_id);
        const quantity = Number(item.quantity);
        const variant = requireLockedCatalogVariantOrderable({
          variant: lockedVariants.get(variantId),
          variantId,
          productId: Number(item.catalog_item_id),
          label: item.label ?? undefined
        });
        if (stockEnforcementEnabled && variant.inventory < quantity) {
          throw new OrderStockConflictError({
            variantId,
            requestedQuantity: quantity,
            availableStock: variant?.inventory ?? 0,
            label: item.label ?? undefined
          });
        }
      }
      const confirmationChallenge =
        await requireOutcomeConfirmation('quote_accepted');
      if (confirmationChallenge) {
        await client.query('rollback to savepoint school_stock_commit');
        await client.query('release savepoint school_stock_commit');
        return {
          ok: false,
          status: 428,
          body: confirmationChallenge,
          persistConflictOutcome: false,
          quoteEmailQueued: false
        };
      }
      if (input.confirmationOnly) {
        await client.query('rollback to savepoint school_stock_commit');
        await client.query('release savepoint school_stock_commit');
        return { ok: true, preflightOnly: true };
      }
      if (stockEnforcementEnabled) {
        await commitOrderStockHolds(
          client,
          orderId,
          items.map((item) => ({
            variantId: Number(item.catalog_variant_id),
            quantity: Number(item.quantity),
            label: item.label ?? undefined
          })),
          {
            type: 'school_purchase_order',
            id: String(purchaseOrderDocumentId)
          }
        );
      }
      await client.query('release savepoint school_stock_commit');
      stockFinalizationOutcome = stockEnforcementEnabled
        ? 'committed_or_verified'
        : 'not_required_stock_enforcement_disabled';
    } catch (error) {
      await client.query('rollback to savepoint school_stock_commit');
      await client.query('release savepoint school_stock_commit');
      if (error instanceof CatalogOrderabilityError) {
        return {
          ok: false,
          status: 409,
          body: {
            code: error.code,
            message:
              'Eden od artiklov v naročilu ni več na voljo. Osvežite naročilo ali izberite drugo različico.'
          },
          persistConflictOutcome: false,
          quoteEmailQueued: false
        };
      }
      if (!(error instanceof OrderStockConflictError)) throw error;
      if (!sourceQuote) {
        return {
          ok: false,
          status: 409,
          body: conflictResult(error),
          persistConflictOutcome: false,
          quoteEmailQueued: false
        };
      }

      if (stockAcceptanceMode === 'manual') {
        return {
          ok: false,
          status: 409,
          body: conflictResult(
            error,
            'Zaloga se je spremenila. Sprejem ni bil izveden; naročilo in ponudba ostajata odprta za ročni pregled in ponovni poskus.'
          ),
          persistConflictOutcome: false,
          quoteEmailQueued: false
        };
      }

      const confirmationChallenge =
        await requireOutcomeConfirmation('quote_acceptance_blocked_stock');
      if (confirmationChallenge) {
        return {
          ok: false,
          status: 428,
          body: confirmationChallenge,
          persistConflictOutcome: false,
          quoteEmailQueued: false
        };
      }
      if (input.confirmationOnly) return { ok: true, preflightOnly: true };

      await client.query(
        sql([
          'insert into quote_events (',
          '  quote_request_id, quote_offer_version_id, event_key, event_type,',
          '  actor_type, occurred_at, request_id, correlation_id, metadata_json',
          ')',
          'values (',
          "  $1, $2, $3, 'acceptance_blocked_stock', 'system', now(), $4,",
          '  coalesce($5, $4, gen_random_uuid()::text), $6::jsonb',
          ')',
          'on conflict (event_key) where event_key is not null do nothing'
        ]),
        [
          sourceQuote.quoteRequestId,
          sourceQuote.id,
          'acceptance-blocked-stock:school:' + sourceQuote.id,
          request.headers.get('x-request-id'),
          request.headers.get('x-correlation-id'),
          JSON.stringify({
            orderId,
            orderNumber: order.order_number,
            purchaseOrderDocumentId,
            variantId: error.variantId,
            requestedQuantity: error.requestedQuantity,
            availableStock: error.availableStock,
            orderCreated: true,
            orderRemainsPending: true,
            stockCommitted: false,
            requiresRevision: true
          })
        ]
      );
      await client.query('savepoint quote_stock_email');
      try {
        const jobs = await enqueueQuoteEmailEvent(client, {
          quoteRequestId: sourceQuote.quoteRequestId,
          quoteOfferVersionId: sourceQuote.id,
          eventKey: 'school-quote-stock-blocked:' + sourceQuote.id,
          eventType: 'quote_acceptance_blocked_stock',
          detail:
            'Naročilnice ni mogoče potrditi zaradi spremenjene zaloge; potrebna je nova različica ponudbe.'
        });
        quoteEmailQueued = jobs.length > 0;
        if (quoteEmailQueued) {
          await client.query(
            sql([
              'insert into quote_events (',
              '  quote_request_id, quote_offer_version_id, event_key,',
              '  event_type, actor_type, occurred_at, metadata_json',
              ')',
              "values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)",
              'on conflict (event_key) where event_key is not null do nothing'
            ]),
            [
              sourceQuote.quoteRequestId,
              sourceQuote.id,
              'quote-email-queued:school-stock-blocked:' + sourceQuote.id,
              JSON.stringify({
                eventType: 'quote_acceptance_blocked_stock',
                jobCount: jobs.length
              })
            ]
          );
        }
        await client.query('release savepoint quote_stock_email');
      } catch (emailError) {
        await client.query('rollback to savepoint quote_stock_email');
        await client.query('release savepoint quote_stock_email');
        console.error('[orders.status] stock email enqueue failed', {
          orderId,
          quoteRequestId: sourceQuote.quoteRequestId,
          message:
            emailError instanceof Error ? emailError.message : 'Unknown error'
        });
      }
      return {
        ok: false,
        status: 409,
        body: conflictResult(
          error,
          'Zaloga se je spremenila. Naročilnico zavrnite in izdajte novo različico ponudbe.'
        ),
        persistConflictOutcome: true,
        quoteEmailQueued
      };
    }
  }

  const acceptedAt = new Date().toISOString();
  const acceptanceResult = await client.query(
    sql([
      'update orders',
      "set commitment_status = 'binding',",
      "    contract_status = 'accepted',",
      '    contract_accepted_at = $2,',
      "    contract_accepted_actor_type = 'school_purchase_order',",
      '    contract_accepted_actor_id = $3,',
      '    contract_acceptance_evidence_json = $4::jsonb,',
      '    contract_state_version = contract_state_version + 1,',
      '    committed_at = $2,',
      '    stock_enforcement_applied = $5',
      'where id = $1',
      "  and status = 'received'",
      "  and customer_type = 'school'",
      "  and commitment_status in ('pending_confirmation', 'binding')",
      "  and contract_status = 'pending_seller_acceptance'",
      '  and deleted_at is null',
      'returning commitment_status, contract_status'
    ]),
    [
      orderId,
      acceptedAt,
      String(purchaseOrderDocumentId),
      JSON.stringify({
        channel: 'admin_status_transition',
        action: 'accept_school_order_for_processing',
        trigger: 'received_to_in_progress',
        buttonWording: 'V obdelavi',
        purchaseOrderDocumentId,
        sourceQuoteOfferVersionId:
          order.source_quote_offer_version_id === null
            ? null
            : Number(order.source_quote_offer_version_id),
        draftAtAcceptance: order.is_draft,
        stockFinalization: stockFinalizationOutcome,
        stockEnforcementApplied: stockEnforcementEnabled,
        stockEnforcementEnabledAtAcceptance: stockEnforcementEnabled
      }),
      stockEnforcementEnabled
    ]
  );
  if (acceptanceResult.rowCount !== 1) {
    throw new Error('Sprejema naročila z naročilnico ni bilo mogoče shraniti.');
  }

  if (sourceQuote) {
    const purchaseOrderContentSha256 = String(
      purchaseOrderDocument.content_sha256 ?? ''
    );
    await client.query(
      sql([
        'insert into quote_offer_acceptances (',
        '  quote_offer_version_id, accepted_at, channel, actor_type, actor_id,',
        '  verified_identity, verification_evidence_json, acceptance_wording,',
        '  terms_version, terms_hash, content_hash, document_sha256,',
        '  request_id, correlation_id',
        ')',
        'values (',
        "  $1, $2, 'purchase_order_validation', 'school_purchase_order',",
        '  $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12',
        ')'
      ]),
      [
        sourceQuote.id,
        acceptedAt,
        String(purchaseOrderDocumentId),
        'purchase-order-sha256:' + purchaseOrderContentSha256,
        JSON.stringify({
          orderId,
          purchaseOrderDocumentId,
          purchaseOrderContentSha256,
          validationChannel: 'admin_status_transition'
        }),
        'V obdelavi',
        sourceQuote.termsVersion,
        sourceQuote.termsHash,
        sourceQuote.contentHash,
        sourceQuote.documentSha256,
        request.headers.get('x-request-id'),
        request.headers.get('x-correlation-id')
      ]
    );
    await client.query(
      sql([
        'update quote_offer_versions',
        "set status = 'accepted',",
        '    is_current = false,',
        '    accepted_at = $2,',
        '    state_version = state_version + 1,',
        '    updated_at = now()',
        'where id = $1'
      ]),
      [sourceQuote.id, acceptedAt]
    );
    await client.query(
      sql([
        'update quote_requests',
        "set status = 'converted_to_order',",
        '    state_version = state_version + 1,',
        '    updated_at = now()',
        'where id = $1'
      ]),
      [sourceQuote.quoteRequestId]
    );
    const revokedQuoteAccessResult = await client.query(
      sql([
        'update quote_access_tokens',
        'set revoked_at = now()',
        'where quote_request_id = $1',
        '  and revoked_at is null',
        'returning id'
      ]),
      [sourceQuote.quoteRequestId]
    );
    revokedQuoteAccessTokenCount = revokedQuoteAccessResult.rowCount ?? 0;
    await client.query(
      sql([
        'insert into quote_events (',
        '  quote_request_id, quote_offer_version_id, event_key, event_type,',
        '  actor_type, occurred_at, request_id, correlation_id, metadata_json',
        ')',
        'values',
        "  ($1, $2, $3, 'admin_purchase_order_validated', 'admin', $6, $7,",
        '   coalesce($8, $7, gen_random_uuid()::text), $9::jsonb),',
        "  ($1, $2, $4, 'customer_accepted', 'customer', $6, $7,",
        '   coalesce($8, $7, gen_random_uuid()::text), $9::jsonb),',
        "  ($1, $2, $5, 'order_created', 'system', $6, $7,",
        '   coalesce($8, $7, gen_random_uuid()::text), $9::jsonb)'
      ]),
      [
        sourceQuote.quoteRequestId,
        sourceQuote.id,
        'purchase-order-validated:' + sourceQuote.id,
        'school-offer-accepted:' + sourceQuote.id,
        'quote-order-created:' + sourceQuote.id,
        acceptedAt,
        request.headers.get('x-request-id'),
        request.headers.get('x-correlation-id'),
        JSON.stringify({
          orderId,
          orderNumber: order.order_number,
          purchaseOrderDocumentId,
          purchaseOrderContentSha256,
          acceptanceTrigger: 'received_to_in_progress',
          quoteAccessTokensRevoked: revokedQuoteAccessTokenCount
        })
      ]
    );
    await client.query('savepoint quote_acceptance_email');
    try {
      const jobs = await enqueueQuoteEmailEvent(client, {
        quoteRequestId: sourceQuote.quoteRequestId,
        quoteOfferVersionId: sourceQuote.id,
        eventKey: 'school-quote-accepted:' + sourceQuote.id,
        eventType: 'quote_accepted',
        detail: 'Ustvarjeno je bilo naročilo ' + order.order_number + '.'
      });
      quoteEmailQueued = quoteEmailQueued || jobs.length > 0;
      if (jobs.length > 0) {
        await client.query(
          sql([
            'insert into quote_events (',
            '  quote_request_id, quote_offer_version_id, event_key,',
            '  event_type, actor_type, occurred_at, metadata_json',
            ')',
            "values ($1, $2, $3, 'quote_email_queued', 'system', now(), $4::jsonb)",
            'on conflict (event_key) where event_key is not null do nothing'
          ]),
          [
            sourceQuote.quoteRequestId,
            sourceQuote.id,
            'quote-email-queued:school-accepted:' + sourceQuote.id,
            JSON.stringify({
              eventType: 'quote_accepted',
              jobCount: jobs.length
            })
          ]
        );
      }
      await client.query('release savepoint quote_acceptance_email');
    } catch (emailError) {
      await client.query('rollback to savepoint quote_acceptance_email');
      await client.query('release savepoint quote_acceptance_email');
      await client.query(
        sql([
          'insert into quote_events (',
          '  quote_request_id, quote_offer_version_id, event_key,',
          '  event_type, actor_type, occurred_at, metadata_json',
          ')',
          "values ($1, $2, $3, 'quote_email_provider_failed', 'system', now(), $4::jsonb)",
          'on conflict (event_key) where event_key is not null do nothing'
        ]),
        [
          sourceQuote.quoteRequestId,
          sourceQuote.id,
          'quote-email-enqueue-failed:school-accepted:' + sourceQuote.id,
          JSON.stringify({ stage: 'enqueue', eventType: 'quote_accepted' })
        ]
      );
      console.error('[orders.status] quote email enqueue failed', {
        orderId,
        quoteRequestId: sourceQuote.quoteRequestId,
        message:
          emailError instanceof Error ? emailError.message : 'Unknown error'
      });
    }
  }

  return {
    ok: true,
    preflightOnly: false,
    purchaseOrderDocumentId,
    quoteEmailQueued,
    quoteOfferVersionId: sourceQuote?.id ?? null,
    quoteRequestId: sourceQuote?.quoteRequestId ?? null,
    revokedQuoteAccessTokenCount,
    stockFinalizationOutcome
  };
}

export { isCatalogSerializationFailure };
