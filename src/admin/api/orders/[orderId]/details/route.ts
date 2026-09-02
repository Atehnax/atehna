import { NextResponse } from 'next/server';
import { revalidateAdminOrderPaths } from '@/shared/server/revalidateAdminOrders';
import { getPool } from '@/shared/server/db';
import { getOrderNumberAvailability } from '@/shared/server/orders';
import { getGursAddressById } from '@/shared/server/gursAddresses';
import { computeObjectDiff, countAuditChangedFields, diffHasEntries } from '@/shared/audit/auditDiff';
import { insertAuditEventForRequest } from '@/shared/server/audit';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { isStockEnforcementEnabled } from '@/shared/server/inventoryPolicy';
import { stockEnforcementAppliedAfterDraftFinalization } from '@/shared/domain/inventory/inventoryPolicy';

import { validatePersistedOrderShippingReadiness } from '@/shared/domain/shipping/shipping';
import {
  commitOrderStockHolds,
  OrderStockConflictError,
  OrderStockReconciliationRequiredError
} from '@/shared/server/orderStockHolds';

const CUSTOMER_TYPES = new Set(['individual', 'company', 'school']);

export async function POST(request: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  try {
    const orderId = Number(params.orderId);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
    }

    const bodyResult = await readRequiredJsonRecord(request);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    const {
      customerType,
      organizationName,
      contactName,
      email,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      countryCode,
      gursHouseNumberId,
      reference,
      notes,
      orderDate,
      orderNumber
    } = body ?? {};

    const gursHouseNumberIdProvided = Object.prototype.hasOwnProperty.call(
      body,
      'gursHouseNumberId'
    );
    if (
      gursHouseNumberIdProvided &&
      gursHouseNumberId !== null &&
      typeof gursHouseNumberId !== 'string'
    ) {
      return NextResponse.json(
        { message: 'Izbrani naslov ni veljaven.' },
        { status: 400 }
      );
    }
    const requestedGursHouseNumberId =
      typeof gursHouseNumberId === 'string'
        ? gursHouseNumberId.trim() || null
        : null;

    const requestedCustomerType =
      typeof customerType === 'string' ? customerType.trim() : '';
    if (requestedCustomerType && !CUSTOMER_TYPES.has(requestedCustomerType)) {
      return NextResponse.json(
        { message: 'Tip naročnika ni veljaven.' },
        { status: 400 }
      );
    }


    const countryCodeProvided = typeof countryCode === 'string';
    const normalizedCountryCode = countryCodeProvided
      ? countryCode.trim().toUpperCase()
      : null;
    if (
      countryCodeProvided &&
      normalizedCountryCode &&
      normalizedCountryCode !== 'SI'
    ) {
      return NextResponse.json(
        { message: 'Za naročilo je podprta samo država Slovenija (SI).' },
        { status: 400 }
      );
    }

    const normalizeOrderDate = (value: unknown) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T00:00:00.000Z`;
      }

      const displayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
      if (!displayMatch) return null;

      const [, day, month, year] = displayMatch;
      const isoDate = `${year}-${month}-${day}`;
      const parsed = new Date(`${isoDate}T00:00:00`);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getUTCFullYear() !== Number(year) ||
        parsed.getUTCMonth() + 1 !== Number(month) ||
        parsed.getUTCDate() !== Number(day)
      ) {
        return null;
      }

      return `${isoDate}T00:00:00.000Z`;
    };

    const normalizedOrderDate = normalizeOrderDate(orderDate);

    const trimmedOrderNumber = typeof orderNumber === 'string' ? orderNumber.trim() : '';
    const orderNumberAvailability = trimmedOrderNumber
      ? await getOrderNumberAvailability(trimmedOrderNumber, orderId, 0)
      : null;

    if (orderNumberAvailability && orderNumberAvailability.normalizedOrderNumber === null) {
      return NextResponse.json({ message: 'Vnesite veljavno številko naročila.' }, { status: 400 });
    }

    if (orderNumberAvailability && !orderNumberAvailability.isAvailable) {
      return NextResponse.json(
        { message: 'Številka naročila je že zasedena.' },
        { status: 409 }
      );
    }

    const pool = await getPool();
    const client = await pool.connect();
    let responsePayload: {
      success: true;
      isDraft: boolean;
      finalized: boolean;
      finalizationBlock: { code: string; message: string } | null;
    } | null = null;
    try {
      await client.query('begin');
      const detailFields = [
        'order_number',
        'customer_type',
        'organization_name',
        'contact_name',
        'email',
        'address_line1',
        'address_line2',
        'postal_code',
        'city',
        'gurs_house_number_id',
        'country_code',
        'reference',
        'notes',
        'created_at',
        'is_draft',
        'commitment_status',
        'contract_status',
        'contract_accepted_at',
        'contract_accepted_actor_type',
        'contract_accepted_actor_id',
        'committed_at'
      ];
      const beforeResult = await client.query(
        `
          select order_number, customer_type, organization_name, contact_name, email, address_line1, address_line2, postal_code, city, gurs_house_number_id, country_code, reference, notes, created_at, status, commitment_status, contract_status, contract_accepted_at, contract_accepted_actor_type, contract_accepted_actor_id, committed_at, is_draft, deleted_at, subtotal, tax, shipping, automatic_shipping, shipping_snapshot_json, shipping_override_json, shipping_override_stale, parcel_count, total
          from orders
          where id = $1
          for update
        `,
        [orderId]
      );
      if (beforeResult.rows.length === 0) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Naročilo ne obstaja.' }, { status: 404 });
      }
      const before = beforeResult.rows[0] as Record<string, unknown>;
      const stockEnforcementEnabled = await isStockEnforcementEnabled(client);
      if (before.deleted_at) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'ORDER_DELETED',
            message: 'Podatkov izbrisanega naročila ni mogoče spreminjati.'
          },
          { status: 409 }
        );
      }

      const currentCustomerType = String(before.customer_type ?? '');
      const currentCommitmentStatus =
        before.commitment_status === null || before.commitment_status === undefined
          ? null
          : String(before.commitment_status);
      const currentContractStatus =
        before.contract_status === null || before.contract_status === undefined
          ? null
          : String(before.contract_status);
      const isDraft = before.is_draft === true;
      let activeStockHoldCountBeforeFinalization = 0;
      if (isDraft) {
        const activeStockHoldsResult = await client.query(
          `
            select count(*)::int as active_hold_count
            from order_stock_holds
            where order_id = $1
              and state = 'held'
          `,
          [orderId]
        );
        activeStockHoldCountBeforeFinalization = Number(
          activeStockHoldsResult.rows[0]?.active_hold_count ?? 0
        );
      }
      const normalizedCustomerType = requestedCustomerType || currentCustomerType;
      const normalizedContactName =
        typeof contactName === 'string'
          ? contactName.trim()
          : String(before.contact_name ?? '').trim();
      const normalizedEmail =
        typeof email === 'string'
          ? email.trim()
          : String(before.email ?? '').trim();
      const normalizedOrganizationName =
        typeof organizationName === 'string'
          ? organizationName.trim() || null
          : before.organization_name ?? null;
      const normalizedReference =
        typeof reference === 'string'
          ? reference.trim() || null
          : before.reference ?? null;
      const normalizedNotes =
        typeof notes === 'string'
          ? notes.trim() || null
          : before.notes ?? null;
      const addressLine1Provided = typeof addressLine1 === 'string';
      const addressLine2Provided = typeof addressLine2 === 'string';
      const postalCodeProvided = typeof postalCode === 'string';
      const cityProvided = typeof city === 'string';
      const normalizedAddressLine1 =
        addressLine1Provided ? addressLine1.trim() || null : null;
      const normalizedAddressLine2 =
        addressLine2Provided ? addressLine2.trim() || null : null;
      const normalizedPostalCode =
        postalCodeProvided ? postalCode.trim() || null : null;
      const normalizedCity = cityProvided ? city.trim() || null : null;
      const nextAddressLine1 = addressLine1Provided
        ? normalizedAddressLine1 ?? ''
        : String(before.address_line1 ?? '').trim();
      const nextPostalCode = postalCodeProvided
        ? normalizedPostalCode ?? ''
        : String(before.postal_code ?? '').trim();
      const nextCity = cityProvided
        ? normalizedCity ?? ''
        : String(before.city ?? '').trim();
      const nextCountryCode = countryCodeProvided
        ? normalizedCountryCode ?? ''
        : String(before.country_code ?? '').trim().toUpperCase();
      const addressWasEdited =
        (addressLine1Provided &&
          normalizedAddressLine1 !== String(before.address_line1 ?? '').trim()) ||
        (postalCodeProvided &&
          normalizedPostalCode !== String(before.postal_code ?? '').trim()) ||
        (cityProvided && normalizedCity !== String(before.city ?? '').trim()) ||
        (countryCodeProvided &&
          normalizedCountryCode !== String(before.country_code ?? '').trim().toUpperCase());
      let normalizedGursHouseNumberId =
        String(before.gurs_house_number_id ?? '').trim() || null;

      if (gursHouseNumberIdProvided) {
        if (requestedGursHouseNumberId) {
          const canonicalAddress = await getGursAddressById(
            requestedGursHouseNumberId,
            client
          );
          if (!canonicalAddress) {
            await client.query('rollback');
            return NextResponse.json(
              { message: 'Izbranega naslova ni več v imeniku GURS. Poiščite ga znova.' },
              { status: 400 }
            );
          }
          if (
            nextAddressLine1 !== canonicalAddress.addressLine1 ||
            nextPostalCode !== canonicalAddress.postalCode ||
            nextCity !== canonicalAddress.postalName ||
            nextCountryCode !== 'SI'
          ) {
            await client.query('rollback');
            return NextResponse.json(
              { message: 'Izbrani naslov se ne ujema z naslovnimi podatki. Izberite predlog znova.' },
              { status: 400 }
            );
          }
          normalizedGursHouseNumberId = canonicalAddress.gursHouseNumberId;
        } else {
          normalizedGursHouseNumberId = null;
        }
      } else if (addressWasEdited) {
        normalizedGursHouseNumberId = null;
      }

      if (!CUSTOMER_TYPES.has(normalizedCustomerType)) {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Tip naročnika ni veljaven.' },
          { status: 400 }
        );
      }

      const nextCommitmentStatus = currentCommitmentStatus;

      let draftStockFinalizationOutcome = isDraft
        ? nextCommitmentStatus === 'binding'
          ? stockEnforcementEnabled
            ? 'not_attempted'
            : 'not_required_stock_enforcement_disabled'
          : 'not_required_non_binding'
        : 'not_applicable';
      let draftFinalizationBlock: { code: string; message: string } | null =
        isDraft &&
        (!normalizedContactName ||
          normalizedContactName.toLocaleLowerCase('sl-SI') === 'osnutek' ||
          !normalizedEmail ||
          normalizedEmail.toLocaleLowerCase('en-US') === 'draft@atehna.si' ||
          !nextAddressLine1 ||
          !/^\d{4}$/.test(nextPostalCode) ||
          !nextCity ||
          nextCountryCode !== 'SI')
          ? {
              code: 'ORDER_DRAFT_CUSTOMER_INCOMPLETE',
              message:
                'Osnutek je shranjen. Za zaključek dopolnite prejemnika in njegov veljaven naslov za dostavo.'
            }
          : null;

      if (isDraft) {
        const shippingCountsResult = await client.query(
          `
            select
              (select count(*)::integer from order_items where order_id = $1) as item_count,
              (
                select count(*)::integer
                from order_line_snapshots
                where order_id = $1
              ) as snapshot_line_count
          `,
          [orderId]
        );
        const shippingCounts = shippingCountsResult.rows[0] as {
          item_count?: number;
          snapshot_line_count?: number;
        } | undefined;
        const shippingReadiness = validatePersistedOrderShippingReadiness({
          expectedItemCount: Number(shippingCounts?.item_count ?? 0),
          snapshotLineCount: Number(shippingCounts?.snapshot_line_count ?? 0),
          subtotal: before.subtotal,
          tax: before.tax,
          shipping: before.shipping,
          automaticShipping: before.automatic_shipping,
          total: before.total,
          shippingSnapshot: before.shipping_snapshot_json,
          shippingOverride: before.shipping_override_json,
          shippingOverrideStale: before.shipping_override_stale,
          parcelCount: before.parcel_count
        });
        if (!shippingReadiness.ok) {
          draftFinalizationBlock ??= {
            code: 'ORDER_DRAFT_SHIPPING_INCOMPLETE',
            message: shippingReadiness.message
          };
        }
        if (
          draftFinalizationBlock === null &&
          stockEnforcementEnabled &&
          nextCommitmentStatus === 'binding'
        ) {
          const allocationsResult = await client.query(
            `
              select
                catalog_variant_id,
                sum(quantity)::integer as quantity,
                min(name) as label
              from order_items
              where order_id = $1
              group by catalog_variant_id
              order by catalog_variant_id
            `,
            [orderId]
          );
          const allocations = allocationsResult.rows as Array<{
            catalog_variant_id: string | number | null;
            quantity: string | number;
            label: string | null;
          }>;
          if (
            allocations.length === 0 ||
            allocations.some((allocation) => allocation.catalog_variant_id === null)
          ) {
            draftStockFinalizationOutcome = 'blocked_missing_catalog_links';
            draftFinalizationBlock = {
              code: 'ORDER_DRAFT_STOCK_LINKS_INCOMPLETE',
              message:
                'Osnutek je shranjen. Za zaključek povežite vse postavke z veljavnimi kataloškimi različicami.'
            };
          } else {
            await client.query('savepoint order_draft_stock_finalization');
            try {
              await commitOrderStockHolds(
                client,
                orderId,
                allocations.map((allocation) => ({
                  variantId: Number(allocation.catalog_variant_id),
                  quantity: Number(allocation.quantity),
                  label: allocation.label ?? undefined
                })),
                { type: 'admin' }
              );
              await client.query('release savepoint order_draft_stock_finalization');
              draftStockFinalizationOutcome = 'committed_or_verified';
            } catch (error) {
              if (
                error instanceof OrderStockConflictError ||
                error instanceof OrderStockReconciliationRequiredError
              ) {
                await client.query('rollback to savepoint order_draft_stock_finalization');
                await client.query('release savepoint order_draft_stock_finalization');
                draftStockFinalizationOutcome =
                  error instanceof OrderStockConflictError
                    ? 'blocked_stock_changed'
                    : 'blocked_reconciliation_required';
                draftFinalizationBlock = {
                  code: error.code,
                  message: `Osnutek je shranjen. ${error.message}`
                };
              } else {
                throw error;
              }
            }
          }
        } else if (
          nextCommitmentStatus === 'binding' &&
          draftStockFinalizationOutcome === 'not_attempted'
        ) {
          draftStockFinalizationOutcome = 'skipped_finalization_blocked';
        }
      }
      const finalizesDraft = isDraft && draftFinalizationBlock === null;
      const finalizedStockEnforcementApplied =
        stockEnforcementAppliedAfterDraftFinalization({
          stockEnforcementEnabled,
          hasActiveStockHolds: activeStockHoldCountBeforeFinalization > 0
        });
      const normalizedOrderNumber =
        orderNumberAvailability?.formattedOrderNumber ?? null;
      await client.query(
        `
          UPDATE orders
          SET customer_type = $1,
              organization_name = $2,
              contact_name = $3,
              email = $4,
              address_line1 = case
                when $13::boolean then $5
                else address_line1
              end,
              address_line2 = case
                when $17::boolean then $18
                else address_line2
              end,
              postal_code = case
                when $14::boolean then $6
                else postal_code
              end,
              city = case
                when $15::boolean then $7
                else city
              end,
              country_code = case
                when $19::boolean then $20
                else country_code
              end,
              reference = $8,
              notes = $9,
              order_number = coalesce(nullif($10::text, ''), order_number),
              created_at = coalesce($11::timestamptz, created_at),
              gurs_house_number_id = $12,
              is_draft = case
                when $21::boolean then false
                else is_draft
              end,
              stock_enforcement_applied = case
                when $21::boolean then $22::boolean
                else stock_enforcement_applied
              end
          WHERE id = $16
        `,
        [
          normalizedCustomerType,
          normalizedOrganizationName,
          normalizedContactName,
          normalizedEmail,
          normalizedAddressLine1,
          normalizedPostalCode,
          normalizedCity,
          normalizedReference,
          normalizedNotes,
          normalizedOrderNumber,
          normalizedOrderDate,
          normalizedGursHouseNumberId,
          addressLine1Provided,
          postalCodeProvided,
          cityProvided,
          orderId,
          addressLine2Provided,
          normalizedAddressLine2,
          countryCodeProvided,
          normalizedCountryCode,
          finalizesDraft,
          finalizedStockEnforcementApplied
        ]
      );

      const afterResult = await client.query(
        `
          select order_number, customer_type, organization_name, contact_name, email, address_line1, address_line2, postal_code, city, gurs_house_number_id, country_code, reference, notes, created_at, is_draft, commitment_status, contract_status, contract_accepted_at, contract_accepted_actor_type, contract_accepted_actor_id, committed_at
          from orders
          where id = $1
        `,
        [orderId]
      );
      const after = afterResult.rows[0] as Record<string, unknown> | undefined;
      const diff = computeObjectDiff(before, after ?? {}, {
        entityType: 'order',
        fields: detailFields,
        labels: {
          is_draft: 'Osnutek',
          commitment_status: 'Status zavezujočnosti',
          contract_status: 'Pogodbeni status',
          contract_accepted_at: 'Pogodba sprejeta',
          contract_accepted_actor_type: 'Način sprejema pogodbe',
          contract_accepted_actor_id: 'Dokaz sprejema pogodbe',
          committed_at: 'Naročilo zavezano'
        }
      });
      if (diffHasEntries(diff) || isDraft) {
        const orderNumberLabel = String(after?.order_number ?? before.order_number ?? `#${orderId}`);
        const auditSummary = finalizesDraft
          ? `Naročilo ${orderNumberLabel}: osnutek zaključen`
          : isDraft
            ? `Naročilo ${orderNumberLabel}: osnutek shranjen`
            : `Naročilo ${orderNumberLabel}: podatki spremenjeni`;
        await insertAuditEventForRequest(request, {
          entityType: 'order',
          entityId: String(orderId),
          entityLabel: `Naročilo ${orderNumberLabel}`,
          action: 'updated',
          summary: auditSummary,
          diff,
          metadata: {
            order_number: orderNumberLabel,
            changed_field_count: countAuditChangedFields(diff),
            customer_type_corrected:
              currentCustomerType !== normalizedCustomerType,
            customer_type_before: currentCustomerType,
            customer_type_after: normalizedCustomerType,
            draft_finalization_attempted: isDraft,
            draft_finalized: finalizesDraft,
            draft_finalization_block_code: draftFinalizationBlock?.code ?? null,
            draft_finalization_block_message: draftFinalizationBlock?.message ?? null,
            stock_finalization_outcome: draftStockFinalizationOutcome,
            stock_enforcement_enabled: stockEnforcementEnabled,
            active_stock_hold_count_before_finalization:
              activeStockHoldCountBeforeFinalization,
            stock_enforcement_preserved:
              !stockEnforcementEnabled &&
              activeStockHoldCountBeforeFinalization > 0,
            commitment_status_before: currentCommitmentStatus,
            commitment_status_after: after?.commitment_status ?? null,
            contract_status_before: currentContractStatus,
            contract_status_after: after?.contract_status ?? null
          }
        }, client);
      }
      await client.query('commit');
      responsePayload = {
        success: true,
        isDraft: isDraft && !finalizesDraft,
        finalized: finalizesDraft,
        finalizationBlock: draftFinalizationBlock
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    revalidateAdminOrderPaths(orderId);
    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Napaka na strežniku.' },
      { status: 500 }
    );
  }
}
