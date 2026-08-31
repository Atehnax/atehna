import { NextResponse } from 'next/server';
import {
  recalculateShippingFromSnapshot,
  SHIPPING_MAX_AMOUNT_CENTS,
  SHIPPING_MAX_PARCEL_COUNT,
  type CalculatedShipping,
  type ShippingCalculation,
  type ShippingManualOverride
} from '@/shared/domain/shipping/shipping';
import { getPool } from '@/shared/server/db';
import {
  getAuditActor,
  insertAuditEventForRequest
} from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { SHIPPING_BEARING_ORDER_PDF_TYPES } from '@/shared/domain/order/orderTypes';

const LOCKED_ORDER_STATUSES = new Set([
  'partially_sent',
  'sent',
  'finished',
  'cancelled'
]);
const LOCKED_PAYMENT_STATUSES = new Set(['paid', 'refunded']);

const conflict = (code: string, message: string) =>
  NextResponse.json({ code, message }, { status: 409 });

const invalidRequest = (code: string, message: string) =>
  NextResponse.json({ code, message }, { status: 400 });

function parseStoredJson(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isSupportedCents(value: unknown): value is number {
  return (
    Number.isSafeInteger(value)
    && Number(value) >= 0
    && Number(value) <= SHIPPING_MAX_AMOUNT_CENTS
  );
}

function parseStoredOverride(value: unknown): ShippingManualOverride | null {
  const record = parseStoredJson(value);
  if (!record) return null;

  const automaticAmountCents = record.automaticAmountCents;
  const originalAmountCents = record.originalAmountCents;
  if (
    typeof record.reason !== 'string' ||
    !record.reason.trim() ||
    !isSupportedCents(record.overrideAmountCents) ||
    !(
      automaticAmountCents === null ||
      isSupportedCents(automaticAmountCents)
    ) ||
    !(
      originalAmountCents === null ||
      isSupportedCents(originalAmountCents)
    )
  ) {
    return null;
  }

  return {
    reason: record.reason.trim(),
    automaticAmountCents: automaticAmountCents as number | null,
    originalAmountCents: originalAmountCents as number | null,
    overrideAmountCents: Number(record.overrideAmountCents),
    actorId: typeof record.actorId === 'string' ? record.actorId : 'system',
    actorName: typeof record.actorName === 'string' ? record.actorName : null,
    appliedAt: typeof record.appliedAt === 'string' ? record.appliedAt : ''
  };
}

function decimalMoneyToCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (cents > BigInt(SHIPPING_MAX_AMOUNT_CENTS)) return null;
  return Number(cents);
}

function centsToDecimalMoney(cents: number) {
  const value = BigInt(cents);
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

type ShippingMutationResult = {
  action: 'override' | 'reset' | 'set_parcel_count';
  shippingCents: number;
  automaticAmountCents: number | null;
  totalCents: number;
  shippingOverride: ShippingManualOverride | null;
  shippingOverrideStale: boolean;
  shippingCalculation?: ShippingCalculation;
  parcelCount?: number;
  pricingRevision?: number;
};

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const params = await props.params;
  const orderId = Number(params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return invalidRequest('INVALID_ORDER_ID', 'Neveljaven ID naro\u010dila.');
  }

  try {
    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const { action } = bodyResult.body;
    if (
      action !== 'override' &&
      action !== 'reset' &&
      action !== 'set_parcel_count'
    ) {
      return invalidRequest(
        'INVALID_SHIPPING_ACTION',
        'Izberite veljavno spremembo po\u0161tnine.'
      );
    }

    const amountCents = bodyResult.body.amountCents;
    const reason =
      typeof bodyResult.body.reason === 'string'
        ? bodyResult.body.reason.trim()
        : '';
    const parcelCount = bodyResult.body.parcelCount;
    const expectedPricingRevision = bodyResult.body.expectedPricingRevision;
    const confirmLockedRecalculation =
      bodyResult.body.confirmLockedRecalculation === true;
    if (
      action === 'override' &&
      !isSupportedCents(amountCents)
    ) {
      return invalidRequest(
        'INVALID_SHIPPING_AMOUNT',
        'Znesek po\u0161tnine mora biti veljavno celo \u0161tevilo centov znotraj podprtega denarnega obmo\u010dja.'
      );
    }
    if (action === 'override' && !reason) {
      return invalidRequest(
        'INVALID_SHIPPING_REASON',
        'Razlog za ro\u010dno spremembo po\u0161tnine je obvezen.'
      );
    }
    if (
      action === 'set_parcel_count' &&
      (
        !Number.isSafeInteger(parcelCount)
        || Number(parcelCount) < 1
        || Number(parcelCount) > SHIPPING_MAX_PARCEL_COUNT
      )
    ) {
      return invalidRequest(
        'INVALID_PARCEL_COUNT',
        `\u0160tevilo paketov mora biti celo \u0161tevilo med 1 in ${String(SHIPPING_MAX_PARCEL_COUNT)}.`
      );
    }
    if (
      action === 'set_parcel_count' &&
      (!Number.isSafeInteger(expectedPricingRevision) || Number(expectedPricingRevision) < 1)
    ) {
      return invalidRequest(
        'INVALID_PRICING_REVISION',
        'Pri\u010dakovana revizija cene naro\u010dila ni veljavna.'
      );
    }
    if (
      action === 'set_parcel_count' &&
      confirmLockedRecalculation &&
      !reason
    ) {
      return invalidRequest(
        'PARCEL_COUNT_RECALCULATION_REASON_REQUIRED',
        'Razlog za poznej\u0161i prera\u010dun po\u0161tnine je obvezen.'
      );
    }

    const pool = await getPool();
    const client = await pool.connect();
    let resultPayload: ShippingMutationResult | null = null;

    try {
      await client.query('begin');
      const orderResult = await client.query(
        `
          select
            id,
            order_number,
            status,
            payment_status,
            deleted_at,
            subtotal,
            tax,
            shipping,
            automatic_shipping,
            shipping_snapshot_json,
            shipping_override_json,
            shipping_override_stale,
            parcel_count,
            pricing_revision,
            source_quote_offer_version_id
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      if (orderResult.rowCount !== 1) {
        await client.query('rollback');
        return NextResponse.json(
          { code: 'ORDER_NOT_FOUND', message: 'Naro\u010dilo ne obstaja.' },
          { status: 404 }
        );
      }

      const order = orderResult.rows[0] as Record<string, unknown>;
      if (order.deleted_at) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_ORDER_DELETED',
          'Po\u0161tnine ni mogo\u010de spreminjati pri izbrisanem naro\u010dilu.'
        );
      }
      if (
        action === 'set_parcel_count' &&
        order.source_quote_offer_version_id !== null
      ) {
        await client.query('rollback');
        return conflict(
          'QUOTE_DERIVED_ORDER_PARCEL_COUNT_LOCKED',
          'Število paketov naročila iz sprejete ponudbe je del nespremenljivega sprejetega posnetka.'
        );
      }

      const paymentStatus = String(order.payment_status ?? '');
      if (
        action !== 'set_parcel_count' &&
        LOCKED_PAYMENT_STATUSES.has(paymentStatus)
      ) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_PAYMENT_LOCKED',
          'Po\u0161tnine ni mogo\u010de spreminjati po pla\u010dilu ali vra\u010dilu pla\u010dila.'
        );
      }

      const orderStatus = String(order.status ?? '');
      if (action === 'set_parcel_count' && orderStatus === 'cancelled') {
        await client.query('rollback');
        return conflict(
          'PARCEL_COUNT_ORDER_CANCELLED',
          '\u0160tevila paketov pri preklicanem naro\u010dilu ni mogo\u010de spremeniti.'
        );
      }
      if (
        action !== 'set_parcel_count' &&
        LOCKED_ORDER_STATUSES.has(orderStatus)
      ) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_STATUS_LOCKED',
          'Po\u0161tnine ni mogo\u010de spreminjati v trenutnem stanju dostave naro\u010dila.'
        );
      }

      const documentResult = await client.query(
        `
          select id
          from order_documents
          where order_id = $1
            and type = any($2::text[])
            and deleted_at is null
            and order_pricing_revision = $3
          order by id asc
          limit 1
          for share
        `,
        [
          orderId,
          [...SHIPPING_BEARING_ORDER_PDF_TYPES],
          Number(order.pricing_revision)
        ]
      );
      const hasShippingBearingDocument = documentResult.rowCount === 1;

      const currentShippingCents = decimalMoneyToCents(order.shipping);
      const automaticAmountCents = decimalMoneyToCents(order.automatic_shipping);
      const automaticSnapshot = parseStoredJson(order.shipping_snapshot_json);
      const snapshotAutomaticAmountCents =
        automaticSnapshot?.automaticAmountCents;
      const hasMatchingAutomaticSnapshot =
        automaticSnapshot?.status === 'calculated'
        && automaticAmountCents !== null
        && isSupportedCents(snapshotAutomaticAmountCents)
        && snapshotAutomaticAmountCents === automaticAmountCents;
      const hasManualQuoteSnapshot =
        automaticSnapshot?.status === 'manual_quote'
        && automaticAmountCents === null;
      if (
        currentShippingCents === null
        || (!hasMatchingAutomaticSnapshot && !hasManualQuoteSnapshot)
      ) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_SNAPSHOT_INVALID',
          'Shranjeni izračun poštnine ni veljaven za ročno spremembo.'
        );
      }
      if (action === 'reset' && automaticAmountCents === null) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_RESET_UNAVAILABLE',
          'Ročne poštnine ni mogoče ponastaviti, dokler samodejni izračun ni na voljo.'
        );
      }
      const previousOverride = parseStoredOverride(order.shipping_override_json);
      const actor = await getAuditActor(request);
      const occurredAt = new Date();

      if (action === 'set_parcel_count') {
        const currentPricingRevision = Number(order.pricing_revision);
        const currentParcelCount = Number(order.parcel_count);
        if (
          !Number.isSafeInteger(currentPricingRevision) ||
          currentPricingRevision !== Number(expectedPricingRevision)
        ) {
          await client.query('rollback');
          return conflict(
            'ORDER_PRICING_REVISION_CHANGED',
            'Cena naročila se je med urejanjem spremenila. Osvežite stran in poskusite znova.'
          );
        }
        if (!Number.isSafeInteger(currentParcelCount) || currentParcelCount < 1) {
          await client.query('rollback');
          return conflict(
            'PARCEL_COUNT_SNAPSHOT_INVALID',
            'Shranjeno število paketov ni veljavno.'
          );
        }

        const requiresExplicitConfirmation =
          LOCKED_PAYMENT_STATUSES.has(paymentStatus) ||
          LOCKED_ORDER_STATUSES.has(orderStatus) ||
          hasShippingBearingDocument;
        if (requiresExplicitConfirmation && !confirmLockedRecalculation) {
          await client.query('rollback');
          return conflict(
            'PARCEL_COUNT_RECALCULATION_CONFIRMATION_REQUIRED',
            'Naročilo je plačano, zaključeno ali ima izdan dokument. Pred preračunom je potrebna izrecna potrditev.'
          );
        }
        if (automaticSnapshot?.status !== 'calculated') {
          await client.query('rollback');
          return conflict(
            'PARCEL_COUNT_AUTOMATIC_SHIPPING_REQUIRED',
            'Števila paketov ni mogoče preračunati brez veljavnega zamrznjenega samodejnega izračuna.'
          );
        }

        let recalculated: ShippingCalculation;
        try {
          recalculated = recalculateShippingFromSnapshot(
            automaticSnapshot as unknown as CalculatedShipping,
            Number(parcelCount)
          );
        } catch {
          await client.query('rollback');
          return conflict(
            'PARCEL_COUNT_SNAPSHOT_INVALID',
            'Zamrznjenih pravil poštnine ni mogoče varno uporabiti za preračun.'
          );
        }
        if (recalculated.status !== 'calculated') {
          await client.query('rollback');
          return conflict(
            'PARCEL_COUNT_RECALCULATION_FAILED',
            recalculated.reason
          );
        }

        const subtotalCents = decimalMoneyToCents(order.subtotal);
        const taxCents = decimalMoneyToCents(order.tax);
        if (subtotalCents === null || taxCents === null) {
          await client.query('rollback');
          return conflict(
            'SHIPPING_OVERRIDE_TOTAL_INVALID',
            'Shranjena osnova ali davek naročila nista veljavna za spremembo poštnine.'
          );
        }

        const nextAutomaticAmountCents = recalculated.automaticAmountCents;
        const nextOverride = previousOverride
          ? { ...previousOverride, automaticAmountCents: nextAutomaticAmountCents }
          : null;
        const nextOverrideStale = Boolean(
          nextOverride && order.shipping_override_stale === true
        );
        const nextShippingCents = nextOverride
          ? nextOverride.overrideAmountCents
          : nextAutomaticAmountCents;
        const nextTotalCents = subtotalCents + taxCents + nextShippingCents;
        if (
          !Number.isSafeInteger(nextTotalCents) ||
          nextTotalCents > SHIPPING_MAX_AMOUNT_CENTS
        ) {
          await client.query('rollback');
          return conflict(
            'SHIPPING_OVERRIDE_TOTAL_OUT_OF_RANGE',
            'Skupni znesek naročila bi presegel podprto denarno območje.'
          );
        }

        const persistedCalculation = requiresExplicitConfirmation
          ? {
              ...recalculated,
              recalculationAuthorization: {
                actorId: actor.actor_id ?? 'system',
                actorName: actor.actor_name,
                confirmedAt: occurredAt.toISOString(),
                reason,
                previousPricingRevision: currentPricingRevision
              }
            }
          : recalculated;
        const updateResult = await client.query(
          `
            update orders
            set parcel_count = $1,
                automatic_shipping = $2::numeric,
                shipping_snapshot_json = $3::jsonb,
                shipping_override_json = $4::jsonb,
                shipping_override_stale = $5::boolean,
                shipping = $6::numeric,
                total = subtotal + tax + $6::numeric,
                pricing_revision = pricing_revision + 1
            where id = $7
              and pricing_revision = $8
            returning
              parcel_count,
              pricing_revision,
              shipping::text as shipping,
              automatic_shipping::text as automatic_shipping,
              total::text as total
          `,
          [
            Number(parcelCount),
            centsToDecimalMoney(nextAutomaticAmountCents),
            JSON.stringify(persistedCalculation),
            nextOverride ? JSON.stringify(nextOverride) : null,
            nextOverrideStale,
            centsToDecimalMoney(nextShippingCents),
            orderId,
            currentPricingRevision
          ]
        );
        if (updateResult.rowCount !== 1) {
          await client.query('rollback');
          return conflict(
            'ORDER_PRICING_REVISION_CHANGED',
            'Cena naročila se je med urejanjem spremenila. Osvežite stran in poskusite znova.'
          );
        }
        const updated = updateResult.rows[0] as Record<string, unknown>;
        const updatedShippingCents = decimalMoneyToCents(updated.shipping);
        const updatedAutomaticAmountCents = decimalMoneyToCents(updated.automatic_shipping);
        const updatedTotalCents = decimalMoneyToCents(updated.total);
        const updatedPricingRevision = Number(updated.pricing_revision);
        if (
          updatedShippingCents === null ||
          updatedAutomaticAmountCents === null ||
          updatedTotalCents === null ||
          !Number.isSafeInteger(updatedPricingRevision)
        ) {
          throw new Error('Shranjeni preračun poštnine ni veljaven.');
        }

        const orderNumber = String(order.order_number ?? `#${orderId}`);
        await insertAuditEventForRequest(
          request,
          {
            occurredAt,
            entityType: 'order',
            entityId: String(orderId),
            entityLabel: `Naročilo ${orderNumber}`,
            action: 'price_changed',
            summary: `Naročilo ${orderNumber}: število paketov in poštnina preračunana`,
            diff: {
              parcel_count: {
                label: 'Število paketov, oddanih skupaj',
                before: String(currentParcelCount),
                after: String(parcelCount)
              },
              shipping: {
                label: 'Poštnina',
                before: centsToDecimalMoney(currentShippingCents),
                after: centsToDecimalMoney(nextShippingCents)
              },
              total: {
                label: 'Skupaj',
                before: centsToDecimalMoney(
                  subtotalCents + taxCents + currentShippingCents
                ),
                after: centsToDecimalMoney(nextTotalCents)
              }
            },
            metadata: {
              order_number: orderNumber,
              shippingAction: action,
              confirmedLockedRecalculation:
                requiresExplicitConfirmation && confirmLockedRecalculation,
              reason: reason || 'Posodobitev števila paketov.',
              previousPricingRevision: currentPricingRevision,
              pricingRevision: updatedPricingRevision,
              merchandiseSubtotalCents: recalculated.merchandiseSubtotalCents,
              singleParcelAmountCents: recalculated.singleParcelAmountCents,
              parcelCountGrossAmountCents: recalculated.parcelCountGrossAmountCents,
              multiPieceDiscountAmountCents: recalculated.multiPieceDiscountAmountCents,
              orderValueDiscountAmountCents: recalculated.orderValueDiscountAmountCents,
              matchedMultiPieceDiscountRule:
                recalculated.matchedMultiPieceDiscountRule,
              matchedOrderValueDiscountRule:
                recalculated.matchedOrderValueDiscountRule,
              manualOverridePreserved: Boolean(nextOverride),
              manualOverrideStalePreserved: nextOverrideStale,
              changed_field_count: 3
            }
          },
          client
        );

        await client.query('commit');
        resultPayload = {
          action,
          shippingCents: updatedShippingCents,
          automaticAmountCents: updatedAutomaticAmountCents,
          totalCents: updatedTotalCents,
          shippingOverride: nextOverride,
          shippingOverrideStale: nextOverrideStale,
          shippingCalculation: recalculated,
          parcelCount: Number(updated.parcel_count),
          pricingRevision: updatedPricingRevision
        };
      } else {
      let nextShippingCents: number;
      let nextOverride: ShippingManualOverride | null;
      let auditReason: string;
      let originalAmountCents: number | null;
      let auditedOverrideAmountCents: number;

      if (action === 'override') {
        nextShippingCents = Number(amountCents);
        originalAmountCents = previousOverride
          ? previousOverride.originalAmountCents
          : automaticAmountCents;
        nextOverride = {
          reason,
          automaticAmountCents,
          originalAmountCents,
          overrideAmountCents: nextShippingCents,
          actorId: actor.actor_id ?? 'system',
          actorName: actor.actor_name,
          appliedAt: occurredAt.toISOString()
        };
        auditReason = reason;
        auditedOverrideAmountCents = nextShippingCents;
      } else {
        nextShippingCents = automaticAmountCents as number;
        nextOverride = null;
        auditReason = previousOverride?.reason ?? 'Ponastavitev na samodejni izra\u010dun.';
        originalAmountCents = previousOverride
          ? previousOverride.originalAmountCents
          : automaticAmountCents;
        auditedOverrideAmountCents =
          previousOverride?.overrideAmountCents ?? currentShippingCents;
      }

      const subtotalCents = decimalMoneyToCents(order.subtotal);
      const taxCents = decimalMoneyToCents(order.tax);
      if (subtotalCents === null || taxCents === null) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_TOTAL_INVALID',
          'Shranjena osnova ali davek naročila nista veljavna za spremembo poštnine.'
        );
      }

      const nextTotalCents = subtotalCents + taxCents + nextShippingCents;
      if (
        !Number.isSafeInteger(nextTotalCents)
        || nextTotalCents > SHIPPING_MAX_AMOUNT_CENTS
      ) {
        await client.query('rollback');
        return conflict(
          'SHIPPING_OVERRIDE_TOTAL_OUT_OF_RANGE',
          'Skupni znesek naročila bi presegel podprto denarno območje.'
        );
      }

      const updateResult = await client.query(
        `
          update orders
          set shipping = $1::numeric,
              shipping_override_json = $2::jsonb,
              shipping_override_stale = false,
              total = subtotal + tax + $1::numeric,
              pricing_revision = pricing_revision + 1
          where id = $3
          returning
            shipping::text as shipping,
            automatic_shipping::text as automatic_shipping,
            total::text as total,
            pricing_revision
        `,
        [
          centsToDecimalMoney(nextShippingCents),
          nextOverride ? JSON.stringify(nextOverride) : null,
          orderId
        ]
      );
      const updated = updateResult.rows[0] as Record<string, unknown>;
      const updatedShippingCents = decimalMoneyToCents(updated.shipping);
      const updatedTotalCents = decimalMoneyToCents(updated.total);
      const updatedPricingRevision = Number(updated.pricing_revision);
      if (
        updatedShippingCents === null
        || updatedTotalCents === null
        || !Number.isSafeInteger(updatedPricingRevision)
      ) {
        throw new Error(
          'Shranjene vrednosti po\u0161tnine ali skupnega zneska niso veljavne.'
        );
      }

      const orderNumber = String(order.order_number ?? `#${orderId}`);
      await insertAuditEventForRequest(
        request,
        {
          occurredAt,
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naro\u010dilo ${orderNumber}`,
          action: 'price_changed',
          summary: action === 'override'
            ? `Naro\u010dilo ${orderNumber}: po\u0161tnina ro\u010dno spremenjena`
            : `Naro\u010dilo ${orderNumber}: po\u0161tnina ponastavljena`,
          diff: {
            shipping: {
              label: 'Po\u0161tnina',
              before: centsToDecimalMoney(currentShippingCents),
              after: centsToDecimalMoney(nextShippingCents)
            }
          },
          metadata: {
            order_number: orderNumber,
            shippingAction: action,
            reason: auditReason,
            originalAmountCents,
            automaticAmountCents,
            overrideAmountCents: auditedOverrideAmountCents,
            changed_field_count: 1
          }
        },
        client
      );

      await client.query('commit');
      resultPayload = {
        action,
        shippingCents: updatedShippingCents,
        automaticAmountCents,
        totalCents: updatedTotalCents,
        shippingOverride: nextOverride,
        shippingOverrideStale: false,
        pricingRevision: updatedPricingRevision
      };
      }
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    revalidateAdminOrderPaths(orderId);
    return NextResponse.json(resultPayload);
  } catch (error) {
    return NextResponse.json(
      {
        code: 'SHIPPING_OVERRIDE_FAILED',
        message: error instanceof Error ? error.message : 'Napaka na stre\u017eniku.'
      },
      { status: 500 }
    );
  }
}
