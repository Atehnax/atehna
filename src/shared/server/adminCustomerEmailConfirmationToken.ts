import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getAdminAuthConfig } from '@/shared/auth/adminSession';
import {
  CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE,
  type AdminCustomerEmailConfirmationChallenge,
  type AdminCustomerEmailConfirmationDelivery
} from '@/shared/domain/email/adminCustomerEmailConfirmation';

const CONFIRMATION_TOKEN_TTL_SECONDS = 5 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001f\u007f]+/gu;

type ConfirmationTokenPayload = Readonly<{
  v: 1;
  action: string;
  deliveries: readonly AdminCustomerEmailConfirmationDelivery[];
  iat: number;
  exp: number;
}>;

export type AdminCustomerEmailDeliveryCandidate = Readonly<{
  scope: 'order' | 'quote';
  entityId: number;
  eventType: string;
  eventLabel: string;
  recipientEmail: unknown;
  masterEmailEnabled: boolean;
  customerAudienceEnabled: boolean;
}>;

type RequireDeliveriesInput = Readonly<{
  action: string;
  actionLabel: string;
  confirmationToken?: unknown;
  confirmCustomerEmails: boolean;
  deliveries: readonly AdminCustomerEmailDeliveryCandidate[];
}>;

function safeLabel(value: string, fallback: string): string {
  const normalized = value.replace(CONTROL_CHARACTERS_PATTERN, ' ')
    .replace(/\s+/gu, ' ').trim().slice(0, 160);
  return normalized || fallback;
}

function normalizedRecipientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function canonicalDeliveries(
  candidates: readonly AdminCustomerEmailDeliveryCandidate[]
): AdminCustomerEmailConfirmationDelivery[] {
  const seen = new Set<string>();
  const deliveries: AdminCustomerEmailConfirmationDelivery[] = [];
  for (const candidate of candidates) {
    if (!candidate.masterEmailEnabled || !candidate.customerAudienceEnabled) continue;
    const recipientEmail = normalizedRecipientEmail(candidate.recipientEmail);
    if (!recipientEmail || !Number.isSafeInteger(candidate.entityId) || candidate.entityId <= 0) continue;
    const delivery: AdminCustomerEmailConfirmationDelivery = {
      scope: candidate.scope,
      entityId: candidate.entityId,
      eventType: safeLabel(candidate.eventType, 'customer_email'),
      eventLabel: safeLabel(candidate.eventLabel, 'E-pošta stranki'),
      recipientEmail
    };
    const key = `${delivery.scope}:${delivery.entityId}:${delivery.eventType}:${delivery.recipientEmail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deliveries.push(delivery);
  }
  return deliveries.sort((left, right) =>
    `${left.scope}:${left.entityId}:${left.eventType}:${left.recipientEmail}`.localeCompare(
      `${right.scope}:${right.entityId}:${right.eventType}:${right.recipientEmail}`
    )
  );
}

function safeTextEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left, 'utf8').digest();
  const rightHash = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftHash, rightHash);
}

function tokenSecret(): string {
  const config = getAdminAuthConfig();
  if (!config) throw new Error('Admin authentication is not configured.');
  return config.sessionSecret;
}

function createConfirmationToken(
  action: string,
  deliveries: readonly AdminCustomerEmailConfirmationDelivery[],
  now = new Date()
): { token: string; expiresAt: string } {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: ConfirmationTokenPayload = {
    v: 1, action, deliveries, iat: issuedAt, exp: issuedAt + CONFIRMATION_TOKEN_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', tokenSecret()).update(encodedPayload, 'utf8').digest('base64url');
  return { token: `${encodedPayload}.${signature}`, expiresAt: new Date(payload.exp * 1000).toISOString() };
}

function verifyConfirmationToken(
  token: unknown,
  action: string,
  deliveries: readonly AdminCustomerEmailConfirmationDelivery[],
  now = new Date()
): boolean {
  if (typeof token !== 'string') return false;
  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra !== undefined) return false;
  const expectedSignature = createHmac('sha256', tokenSecret()).update(encodedPayload, 'utf8').digest('base64url');
  if (!safeTextEqual(suppliedSignature, expectedSignature)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<ConfirmationTokenPayload>;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    return payload.v === 1 && payload.action === action && typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' && payload.iat <= nowSeconds + 30 && payload.exp > nowSeconds &&
      JSON.stringify(payload.deliveries) === JSON.stringify(deliveries);
  } catch {
    return false;
  }
}

export function requireAdminCustomerEmailConfirmationForDeliveries({
  action,
  actionLabel,
  confirmationToken,
  confirmCustomerEmails,
  deliveries: candidates
}: RequireDeliveriesInput): AdminCustomerEmailConfirmationChallenge | null {
  if (!confirmCustomerEmails) return null;
  const normalizedAction = safeLabel(action, 'admin_action');
  const deliveries = canonicalDeliveries(candidates);
  if (deliveries.length === 0 || verifyConfirmationToken(confirmationToken, normalizedAction, deliveries)) return null;

  const { token, expiresAt } = createConfirmationToken(normalizedAction, deliveries);
  const first = deliveries[0];
  const normalizedActionLabel = safeLabel(actionLabel, 'Administratorsko dejanje');
  const recipientCount = new Set(deliveries.map((delivery) => delivery.recipientEmail)).size;
  const message = deliveries.length === 1
    ? `Dejanje »${normalizedActionLabel}« bo poslalo e-poštno sporočilo stranki ${first.recipientEmail}. Potrdite nadaljevanje.`
    : `Dejanje »${normalizedActionLabel}« bo poslalo ${deliveries.length} e-poštnih sporočil ${recipientCount} prejemnikom. Potrdite nadaljevanje.`;
  return {
    code: CUSTOMER_EMAIL_CONFIRMATION_REQUIRED_CODE,
    message,
    scope: deliveries.length === 1 ? first.scope : 'multiple',
    action: normalizedAction,
    actionLabel: normalizedActionLabel,
    eventType: first.eventType,
    eventLabel: first.eventLabel,
    recipientEmail: first.recipientEmail,
    deliveries,
    confirmationToken: token,
    expiresAt
  };
}
