import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
import { isQuoteAdminEnabled } from '@/shared/server/quoteFeatureFlags';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import { lockQuoteWorkflow } from '@/shared/server/quoteAccess';
import { isManuallyEditableQuoteRequestStatus } from '@/shared/domain/quote/quoteRequestStatus';
import {
  appendQuoteEvent,
  boundedText,
  expectedVersion,
  hasValidQuoteAdminSession,
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
    if (
      submittedStatus &&
      !isManuallyEditableQuoteRequestStatus(submittedStatus)
    ) {
      return NextResponse.json(
        { message: 'Izbrani status ni dovoljen za ročno urejanje.' },
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
      if (!isManuallyEditableQuoteRequestStatus(String(before.status))) {
        await client.query('rollback');
        return NextResponse.json(
          { message: 'Podatke je mogoče urejati samo pred izdajo ponudbe.' },
          { status: 409 }
        );
      }
      const status = submittedStatus || String(before.status);

      const issuedResult = await client.query(
        `
          select id
          from quote_offer_versions
          where quote_request_id = $1
            and status = 'issued'
            and is_current = true
          limit 1
          for share
        `,
        [quoteRequestId]
      );
      if (issuedResult.rowCount) {
        await client.query('rollback');
        return NextResponse.json(
          {
            code: 'QUOTE_CUSTOMER_SNAPSHOT_LOCKED',
            message: 'Podatki izdane ponudbe so zaklenjeni. Najprej pripravite varno novo različico.'
          },
          { status: 409 }
        );
      }

      const addressChanged =
        comparableText(before.address_line1) !== comparableText(addressLine1) ||
        comparableText(before.address_line2) !== comparableText(addressLine2) ||
        comparableText(before.postal_code) !== comparableText(postalCode) ||
        comparableText(before.city) !== comparableText(city) ||
        comparableText(before.country_code).toUpperCase() !== countryCode;
      const gursHouseNumberId = addressChanged
        ? null
        : comparableText(before.gurs_house_number_id) || null;
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
        gursHouseNumberId,
        reference
      };
      const fieldPairs: Array<[string, unknown, unknown]> = [
        ['customerType', before.customer_type, customerType],
        ['organizationName', before.organization_name, organizationName],
        ['contactName', before.contact_name, contactName],
        ['email', before.email, email],
        ['addressLine1', before.address_line1, addressLine1],
        ['addressLine2', before.address_line2, addressLine2],
        ['postalCode', before.postal_code, postalCode],
        ['city', before.city, city],
        ['countryCode', before.country_code, countryCode],
        ['reference', before.reference, reference],
        ['quoteReason', before.quote_reason, quoteReason],
        ['customerMessage', before.customer_message, customerMessage]
      ];
      const detailChangedFields = fieldPairs
        .filter(([, previous, next]) => comparableText(previous) !== comparableText(next))
        .map(([field]) => field);
      const statusChanged = String(before.status) !== status;
      const changedFields = [
        ...detailChangedFields,
        ...(statusChanged ? ['status'] : [])
      ];

      if (changedFields.length === 0) {
        await client.query('commit');
        return NextResponse.json({
          success: true,
          stateVersion: Number(before.state_version),
          draftStateVersion: null,
          status,
          message: 'Ni sprememb za shranjevanje.'
        });
      }

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
              gurs_house_number_id = case when $11 then null else gurs_house_number_id end,
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
          addressChanged,
          reference,
          quoteReason,
          customerMessage,
          JSON.stringify(customerSnapshot),
          status,
          detailChangedFields.length > 0
        ]
      );
      const stateVersion = Number(updateResult.rows[0]?.state_version);
      let draftStateVersion: number | null = null;
      let draftSnapshotUpdated = false;
      if (detailChangedFields.length > 0) {
        const draftUpdateResult = await client.query(
          `
            update quote_offer_versions
            set customer_snapshot_json = $2::jsonb,
                billing_snapshot_json = $2::jsonb,
                acceptance_method = $3,
                state_version = state_version + 1,
                updated_at = now()
            where quote_request_id = $1
              and status = 'draft'
            returning id, state_version
          `,
          [
            quoteRequestId,
            JSON.stringify(customerSnapshot),
            customerType === 'school' ? 'purchase_order' : 'online'
          ]
        );
        draftStateVersion = draftUpdateResult.rows[0]
          ? Number(draftUpdateResult.rows[0].state_version)
          : null;
        draftSnapshotUpdated = draftUpdateResult.rowCount === 1;
      }

      const evidence = await quoteAdminEvidence(request);
      await appendQuoteEvent(client, {
        quoteRequestId,
        eventKey: `quote-request:${quoteRequestId}:details:${stateVersion}`,
        eventType: 'quote_request_details_changed',
        actorType: 'admin',
        actorId: evidence.actorId,
        requestId: evidence.requestId,
        metadata: {
          changedFields,
          changedFieldCount: changedFields.length,
          detailChangedFields,
          previousStatus: String(before.status),
          nextStatus: status,
          statusChanged,
          draftSnapshotUpdated
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
            draft_snapshot_updated: draftSnapshotUpdated
          }
        });
      }
      if (statusChanged) {
        await mirrorQuoteAdminAudit(request, client, {
          quoteRequestId,
          requestNumber: String(before.request_number),
          action: 'status_changed',
          summary: `Povpraševanje ${before.request_number}: status ${before.status} → ${status}`,
          beforeStatus: String(before.status),
          afterStatus: status,
          metadata: {
            manual: true
          }
        });
      }

      await client.query('commit');
      return NextResponse.json({
        success: true,
        stateVersion,
        draftStateVersion,
        status,
        message: statusChanged && detailChangedFields.length === 0
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
