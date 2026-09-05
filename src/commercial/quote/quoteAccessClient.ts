'use client';

import { readJsonResponse } from '@/shared/client/readJsonResponse';

const QUOTE_ACCESS_ID_STORAGE_KEY = 'atehna-quote-access-id-v1';
const QUOTE_CSRF_TOKEN_STORAGE_KEY = 'atehna-quote-csrf-token-v1';
const QUOTE_ACCESS_SESSION_ENDPOINT = '/api/quote-requests/access-session';

export type QuoteAccessSession = {
  accessId: string;
  csrfToken: string | null;
  expiresAt: string | null;
};

const cleanValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function consumeQuoteAccessTokenFromLocation(): string | null {
  const currentUrl = new URL(window.location.href);
  const fragmentParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ''));
  const fragmentToken = cleanValue(fragmentParams.get('token'));

  if (fragmentParams.has('token')) {
    fragmentParams.delete('token');
    currentUrl.hash = fragmentParams.size > 0 ? fragmentParams.toString() : '';
    window.history.replaceState(
      window.history.state,
      '',
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );
  }

  return fragmentToken || null;
}

export function buildQuoteRequestConfirmationFragmentUrl(token: string): string {
  return `/quote-request/confirmation#token=${encodeURIComponent(token.trim())}`;
}

export function buildQuoteOfferReviewFragmentUrl(token: string): string {
  return `/quote/offer#token=${encodeURIComponent(token.trim())}`;
}

export function readStoredQuoteAccessSession(): QuoteAccessSession | null {
  try {
    const accessId = cleanValue(
      window.sessionStorage.getItem(QUOTE_ACCESS_ID_STORAGE_KEY)
    );
    if (!accessId) return null;
    return {
      accessId,
      csrfToken:
        cleanValue(window.sessionStorage.getItem(QUOTE_CSRF_TOKEN_STORAGE_KEY)) ||
        null,
      expiresAt: null
    };
  } catch {
    return null;
  }
}

export function storeQuoteAccessSession(
  accessId: string,
  csrfToken?: string | null
): void {
  const normalizedAccessId = cleanValue(accessId);
  if (!normalizedAccessId) {
    throw new Error('Seje za prikaz povpraševanja ni bilo mogoče ustvariti.');
  }

  try {
    window.sessionStorage.setItem(
      QUOTE_ACCESS_ID_STORAGE_KEY,
      normalizedAccessId
    );
    const normalizedCsrfToken = cleanValue(csrfToken);
    if (normalizedCsrfToken) {
      window.sessionStorage.setItem(
        QUOTE_CSRF_TOKEN_STORAGE_KEY,
        normalizedCsrfToken
      );
    } else {
      window.sessionStorage.removeItem(QUOTE_CSRF_TOKEN_STORAGE_KEY);
    }
  } catch {
    throw new Error(
      'Brskalnik ni dovolil varne seje. Omogočite shranjevanje podatkov za to stran in poskusite znova.'
    );
  }
}

export async function exchangeQuoteAccessToken(
  token: string,
  purpose: 'confirmation' | 'offer' = 'confirmation'
): Promise<QuoteAccessSession> {
  const normalizedToken = cleanValue(token);
  if (!normalizedToken) {
    throw new Error('Povezava za prikaz ponudbe ni veljavna.');
  }

  const response = await fetch(QUOTE_ACCESS_SESSION_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: normalizedToken, purpose })
  });
  const payload: unknown = await readJsonResponse(response, {});
  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
  if (!response.ok) {
    throw new Error(
      typeof record.message === 'string'
        ? record.message
        : 'Varne seje za prikaz ponudbe ni bilo mogoče ustvariti.'
    );
  }

  const accessId = cleanValue(record.accessId);
  const csrfToken = cleanValue(record.csrfToken) || null;
  if (!accessId) {
    throw new Error('Varne seje za prikaz ponudbe ni bilo mogoče ustvariti.');
  }
  storeQuoteAccessSession(accessId, csrfToken);
  return {
    accessId,
    csrfToken,
    expiresAt: cleanValue(record.expiresAt) || null
  };
}

export function buildQuoteAccessHeaders(
  session: QuoteAccessSession,
  mutation = false
): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Quote-Access-Id': session.accessId,
    ...(mutation && session.csrfToken
      ? { 'X-Quote-CSRF-Token': session.csrfToken }
      : {})
  };
}
