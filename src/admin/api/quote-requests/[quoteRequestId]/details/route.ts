import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import { getGursAddressById } from '@/shared/server/gursAddresses';
import {
  createQuoteOfferDraftRevision,
  type QuoteOfferRevisionSource
} from '@/shared/server/quoteOfferRevision';
import { isManuallyEditableQuoteRequestStatus } from '@/shared/domain/quote/quoteRequestStatus';
import {
  appendQuoteEvent,
  boundedText,
  expectedVersion,
  hasValidQuoteAdminSession,
  lockPendingQuotePurchaseOrder,
  mirrorQuoteAdminAudit,
  quoteAdminEvidence
} from '@/admin/api/quote-requests/quoteAdminRouteUtils';

const CUSTOMER_TYPES = new Set(['individual', 'company', 'school']);
const QUOTE_REASONS = new Set([
  'formal_offer',
  'stock_or_delivery',
  'quantity_discount_or_custom_quantity',
  'other'
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const POSTAL_CODE_PATTERN = /^\d{4}$/u;

const nullableText = (value: unknown, maximum: number) =>
  boundedText(value, maximum) || null;

const comparableText = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).trim();

const jsonRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export async function PUT(
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

  try {
    const expectedRequestStateVersion = expectedVersion(
      parsed.body.expectedRequestStateVersion
    );
    const expectedDraftStateVersion = expectedVersion(
      parsed.body.expectedDraftStateVersion
    );
    const customerType = boundedText(parsed.body.customerType, 32);
    const submittedOrganizationName = nullableText(
      parsed.body.organizationName,
      240
    );
    const organizationName = customerType === 'individual'
      ? null
      : submittedOrganizationName;
    const contactName = boundedText(parsed.body.contactName, 240);
    const email = boundedText(parsed.body.email, 320).toLowerCase();
    const addressLine1 = nullableText(parsed.body.addressLine1, 300);
    const addressLine2 = nullableText(parsed.body.addressLine2, 500);
    const postalCode = nullableText(parsed.body.postalCode, 16);
    const city = nullableText(parsed.body.city, 160);
    const countryCode = boundedText(parsed.body.countryCode, 2).toUpperCase();
    const gursHouseNumberIdProvided = Object.prototype.hasOwnProperty.call(
      parsed.body,
      'gursHouseNumberId'
    );
    const rawGursHouseNumberId = parsed.body.gursHouseNumberId;
    if (
      gursHouseNumberIdProvided &&
      rawGursHouseNumberId !== null &&
      typeof rawGursHouseNumberId !== 'string'
    ) {
      return NextResponse.json(
        { message: 'Izbrani naslov ni veljaven.' },
        { status: 400 }
      );
    }
    const submittedGursHouseNumberId =
      typeof rawGursHouseNumberId === 'string'
        ? rawGursHouseNumberId.trim() || null
        : null;
    const reference = nullableText(parsed.body.reference, 240);
    const quoteReason = boundedText(parsed.body.quoteReason, 80);
    const customerMessage = nullableText(parsed.body.customerMessage, 8_000);
    const submittedStatus = boundedText(parsed.body.status, 64);

    if (!expectedRequestStateVersion) {
      return NextResponse.json(
        { code: 'QUOTE_REQUEST_STALE', message: 'Osvežite stran in znova shranite podatke.' },
        { status: 409 }
      );
    }
    if (
      !CUSTOMER_TYPES.has(customerType) ||
      !QUOTE_REASONS.has(quoteReason) ||
      !contactName ||
      !EMAIL_PATTERN.test(email)
    ) {
      return NextResponse.json(
        { message: 'Preverite obvezne podatke o naročniku in povpraševanju.' },
        { status: 400 }
      );
    }
    if (customerType !== 'individual' && !organizationName) {
      return NextResponse.json(
        { message: 'Vnesite naziv organizacije.' },
        { status: 400 }
      );
    }
    if (postalCode !== null && !POSTAL_CODE_PATTERN.test(postalCode)) {
      return NextResponse.json(
        { message: 'Poštna številka mora vsebovati štiri številke.' },
        { status: 400 }
      );
    }
    if (countryCode !== 'SI') {
      return NextResponse.json(
        { message: 'Za povpraševanje je podprta samo država Slovenija (SI).' },
        { status: 400 }
      );
    }
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await lockQuoteWorkflow(client, quoteRequestId);
      const requestResult = await client.query(
        'select * from quote_requests where id = $1 for update',
        [quoteRequestId]
      );
      const before = requestResult.rows[0] as Record<string, unknown> | undefined;
      if (!before) {
        await client.query('rollback');
        return NextResponse.json({ message: 'Povpraševanje ne obstaja.' }, { status: 404 });
      }
      if (before.voided_at) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_REQUEST_VOIDED',
            message: 'Povpraševanje je odstranjeno in ga ni več mogoče urejati.'
          },
          { status: 409 }
        );
      }
      if (Number(before.state_version) !== expectedRequestStateVersion) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_REQUEST_STALE',
            message: 'Povpraševanje je bilo medtem spremenjeno. Osvežite stran.'
          },
          { status: 409 }
        );
      }
      const previousStatus = String(before.status);
      const requestedStatus = submittedStatus || previousStatus;
      if (
        requestedStatus !== previousStatus &&
        (
          !isManuallyEditableQuoteRequestStatus(previousStatus) ||
          !isManuallyEditableQuoteRequestStatus(requestedStatus)
        )
      ) {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Izbrani status ni dovoljen za ročno urejanje.' },
          { status: 400 }
        );
      }

      const offerVersionsResult = await client.query(
        `
          select *
          from quote_offer_versions
          where quote_request_id = $1
            and (
              status = 'draft'
              or (status = 'issued' and is_current = true)
            )
          order by
            case when status = 'draft' then 0 else 1 end,
            version_number desc
          for update
        `,
        [quoteRequestId]
      );
      let draftOffer = offerVersionsResult.rows.find(
        (row) => row.status === 'draft'
      ) as Record<string, unknown> | undefined;
      const currentIssuedOffer = offerVersionsResult.rows.find(
        (row) => row.status === 'issued' && row.is_current === true
      ) as Record<string, unknown> | undefined;

      if (
        !isManuallyEditableQuoteRequestStatus(previousStatus) &&
        !currentIssuedOffer
      ) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_CUSTOMER_CORRECTION_REQUIRES_REVISION',
            message: 'Podatke zgodovinske ponudbe popravite v novi različici.'
          },
          { status: 409 }
        );
      }
      if (currentIssuedOffer && requestedStatus !== previousStatus) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_STATUS_LIFECYCLE_OWNED',
            message: 'Status izdane ponudbe upravljajte z dejanji poteka.'
          },
          { status: 409 }
        );
      }

      const draftCustomerSnapshot =
        currentIssuedOffer && draftOffer
          ? jsonRecord(draftOffer.customer_snapshot_json)
          : {};
      const previousDetail = (snapshotKey: string, requestKey: string) =>
        Object.prototype.hasOwnProperty.call(draftCustomerSnapshot, snapshotKey)
          ? draftCustomerSnapshot[snapshotKey]
          : before[requestKey];

      const addressChanged =
        comparableText(previousDetail('addressLine1', 'address_line1')) !== comparableText(addressLine1) ||
        comparableText(previousDetail('postalCode', 'postal_code')) !== comparableText(postalCode) ||
        comparableText(previousDetail('city', 'city')) !== comparableText(city) ||
        comparableText(previousDetail('countryCode', 'country_code')).toUpperCase() !== countryCode;
      let resolvedGursHouseNumberId =
        comparableText(previousDetail('gursHouseNumberId', 'gurs_house_number_id')) || null;

      if (gursHouseNumberIdProvided) {
        if (submittedGursHouseNumberId) {
          const canonicalAddress = await getGursAddressById(
            submittedGursHouseNumberId,
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
            comparableText(addressLine1) !== canonicalAddress.addressLine1 ||
            comparableText(postalCode) !== canonicalAddress.postalCode ||
            comparableText(city) !== canonicalAddress.postalName ||
            countryCode !== 'SI'
          ) {
            await client.query('rollback');
            return NextResponse.json(
              { message: 'Izbrani naslov se ne ujema z naslovnimi podatki. Izberite predlog znova.' },
              { status: 400 }
            );
          }
          resolvedGursHouseNumberId = canonicalAddress.gursHouseNumberId;
        } else {
          resolvedGursHouseNumberId = null;
        }
      } else if (addressChanged) {
        resolvedGursHouseNumberId = null;
      }

      const customerSnapshot = {
        customerType,
        organizationName,
        contactName,
        email,
        addressLine1,
        addressLine2,
        city,
        postalCode,
        countryCode,
        gursHouseNumberId: resolvedGursHouseNumberId,
        reference,
        quoteReason,
        customerMessage
      };
      const fieldPairs: Array<[string, unknown, unknown]> = [
        ['customerType', previousDetail('customerType', 'customer_type'), customerType],
        ['organizationName', previousDetail('organizationName', 'organization_name'), organizationName],
        ['contactName', previousDetail('contactName', 'contact_name'), contactName],
        ['email', previousDetail('email', 'email'), email],
        ['addressLine1', previousDetail('addressLine1', 'address_line1'), addressLine1],
        ['addressLine2', previousDetail('addressLine2', 'address_line2'), addressLine2],
        ['postalCode', previousDetail('postalCode', 'postal_code'), postalCode],
        ['city', previousDetail('city', 'city'), city],
        ['countryCode', previousDetail('countryCode', 'country_code'), countryCode],
        ['gursHouseNumberId', previousDetail('gursHouseNumberId', 'gurs_house_number_id'), resolvedGursHouseNumberId],
        ['reference', previousDetail('reference', 'reference'), reference],
        ['quoteReason', previousDetail('quoteReason', 'quote_reason'), quoteReason],
        ['customerMessage', previousDetail('customerMessage', 'customer_message'), customerMessage]
      ];
      const detailChangedFields = fieldPairs
        .filter(([, previous, following]) =>
          comparableText(previous) !== comparableText(following)
        )
        .map(([field]) => field);
      if (
        draftOffer &&
        expectedDraftStateVersion &&
        Number(draftOffer.state_version) !== expectedDraftStateVersion
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
      const issuedCorrection = Boolean(
        currentIssuedOffer && detailChangedFields.length > 0
      );
      const status = issuedCorrection ? 'in_preparation' : requestedStatus;
      const statusChanged = previousStatus !== status;
      const changedFields = [
        ...detailChangedFields,
        ...(statusChanged ? ['status'] : [])
      ];

      if (changedFields.length === 0) {
        await client.query('commit');
        return NextResponse.json({
          success: true,
          stateVersion: Number(before.state_version),
          draftStateVersion: draftOffer
            ? Number(draftOffer.state_version)
            : null,
          quoteOfferVersionId: draftOffer ? Number(draftOffer.id) : null,
          draftVersionNumber: draftOffer
            ? Number(draftOffer.version_number)
            : null,
          revisionCreated: false,
          correctionScope: currentIssuedOffer ? 'draft_revision' : 'request',
          status,
          message: 'Ni sprememb za shranjevanje.'
        });
      }

      const evidence = await quoteAdminEvidence(request);
      let revisionCreated = false;
      if (issuedCorrection && !draftOffer && currentIssuedOffer) {
        const issuedOffer = currentIssuedOffer;
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
        const createdDraft = await createQuoteOfferDraftRevision(client, {
          quoteRequestId,
          source: issuedOffer as QuoteOfferRevisionSource,
          actorId: evidence.actorId
        });
        draftOffer = {
          id: createdDraft.id,
          version_number: createdDraft.versionNumber,
          state_version: createdDraft.stateVersion
        };
        revisionCreated = true;
        await appendQuoteEvent(client, {
          quoteRequestId,
          quoteOfferVersionId: createdDraft.id,
          eventKey: `draft-created:${createdDraft.id}`,
          eventType: 'draft_created',
          actorType: 'admin',
          actorId: evidence.actorId,
          requestId: evidence.requestId,
          metadata: {
            versionNumber: createdDraft.versionNumber,
            revisedFromOfferVersionId: Number(issuedOffer.id),
            revisedFromOfferNumber: issuedOffer.offer_number,
            sourceStatus: issuedOffer.status,
            sourceRemainsImmutable: true,
            sourceRemainsCurrentUntilIssue: true,
            reason: 'customer_details_correction'
          }
        });
      }

      let stateVersion: number;
      if (currentIssuedOffer) {
        const requestUpdateResult = await client.query(
          `
            update quote_requests
            set status = $2,
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
            returning state_version
          `,
          [quoteRequestId, status]
        );
        stateVersion = Number(requestUpdateResult.rows[0]?.state_version);
      } else {
        const updateResult = await client.query(
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
                billing_snapshot_json = case
                  when $17 then $15::jsonb
                  else billing_snapshot_json
                end,
                status = $16,
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
            returning state_version
          `,
          [
            quoteRequestId,
            customerType,
            organizationName,
            contactName,
            email,
            addressLine1,
            addressLine2,
            postalCode,
            city,
            countryCode,
            resolvedGursHouseNumberId,
            reference,
            quoteReason,
            customerMessage,
            JSON.stringify(customerSnapshot),
            status,
            detailChangedFields.length > 0
          ]
        );
        stateVersion = Number(updateResult.rows[0]?.state_version);
      }

      let draftStateVersion: number | null = null;
      let draftSnapshotUpdated = false;
      if (detailChangedFields.length > 0 && draftOffer) {
        const draftUpdateResult = await client.query(
          `
            update quote_offer_versions
            set customer_snapshot_json = $2::jsonb,
                billing_snapshot_json = $2::jsonb,
                acceptance_method = $3,
                state_version = state_version + 1,
                updated_at = now()
            where id = $1
              and status = 'draft'
            returning state_version
          `,
          [
            Number(draftOffer.id),
            JSON.stringify(customerSnapshot),
            customerType === 'school' ? 'purchase_order' : 'online'
          ]
        );
        draftStateVersion = draftUpdateResult.rows[0]
          ? Number(draftUpdateResult.rows[0].state_version)
          : null;
        draftSnapshotUpdated = draftUpdateResult.rowCount === 1;
      }

      await appendQuoteEvent(client, {
        quoteRequestId,
        quoteOfferVersionId: draftOffer ? Number(draftOffer.id) : undefined,
        eventKey: `quote-request:${quoteRequestId}:details:${stateVersion}`,
        eventType: 'quote_request_details_changed',
        actorType: 'admin',
        actorId: evidence.actorId,
        requestId: evidence.requestId,
        metadata: {
          changedFields,
          changedFieldCount: changedFields.length,
          detailChangedFields,
          previousStatus,
          nextStatus: status,
          statusChanged,
          draftSnapshotUpdated,
          correctionScope: currentIssuedOffer ? 'draft_revision' : 'request',
          revisionCreated,
          issuedOfferVersionId: currentIssuedOffer
            ? Number(currentIssuedOffer.id)
            : null,
          issuedSnapshotPreserved: Boolean(currentIssuedOffer),
          previousCustomerType: comparableText(
            previousDetail('customerType', 'customer_type')
          ),
          nextCustomerType: customerType
        }
      });
      if (detailChangedFields.length > 0) {
        await mirrorQuoteAdminAudit(request, client, {
          quoteRequestId,
          requestNumber: String(before.request_number),
          action: 'updated',
          summary: `Povpraševanje ${before.request_number}: podatki naročnika spremenjeni`,
          metadata: {
            changed_fields: detailChangedFields,
            changed_field_count: detailChangedFields.length,
            draft_snapshot_updated: draftSnapshotUpdated,
            correction_scope: currentIssuedOffer ? 'draft_revision' : 'request',
            revision_created: revisionCreated,
            issued_offer_version_id: currentIssuedOffer
              ? Number(currentIssuedOffer.id)
              : null,
            issued_snapshot_preserved: Boolean(currentIssuedOffer),
            previous_customer_type: comparableText(
              previousDetail('customerType', 'customer_type')
            ),
            next_customer_type: customerType
          }
        });
      }
      if (statusChanged) {
        await mirrorQuoteAdminAudit(request, client, {
          quoteRequestId,
          requestNumber: String(before.request_number),
          action: 'status_changed',
          summary: `Povpraševanje ${before.request_number}: status ${previousStatus} → ${status}`,
          beforeStatus: previousStatus,
          afterStatus: status,
          metadata: {
            manual: !issuedCorrection,
            reason: issuedCorrection
              ? 'customer_details_correction_revision'
              : 'manual'
          }
        });
      }

      await client.query('commit');
      return NextResponse.json({
        success: true,
        stateVersion,
        draftStateVersion,
        quoteOfferVersionId: draftOffer ? Number(draftOffer.id) : null,
        draftVersionNumber: draftOffer
          ? Number(draftOffer.version_number)
          : null,
        revisionCreated,
        correctionScope: currentIssuedOffer ? 'draft_revision' : 'request',
        issuedOfferVersionId: currentIssuedOffer
          ? Number(currentIssuedOffer.id)
          : null,
        status,
        message: issuedCorrection
          ? 'Popravek je shranjen v novi različici ponudbe.'
          : statusChanged && detailChangedFields.length === 0
            ? 'Status povpraševanja je shranjen.'
            : 'Podatki povpraševanja so shranjeni.'
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error
          ? error.message
          : 'Podatkov povpraševanja ni bilo mogoče shraniti.'
      },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
