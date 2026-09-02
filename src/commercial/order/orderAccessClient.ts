'use client';

import { readJsonResponse } from '@/shared/client/readJsonResponse';

const ORDER_ACCESS_ID_STORAGE_KEY = 'atehna-order-access-id-v1';
const ORDER_ACCESS_SESSION_ENDPOINT = '/api/orders/access-session';

export type OrderAccessSession = {
  accessId: string;
  expiresAt: string | null;
};

const cleanValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function consumeOrderAccessTokenFromLocation(): string | null {
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

export function extractOrderAccessTokenFromUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);
    const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    return cleanValue(fragmentParams.get('token')) || null;
  } catch {
    return null;
  }
}

export function buildOrderConfirmationFragmentUrl(token: string): string {
  return `/order/confirmation#token=${encodeURIComponent(token.trim())}`;
}

export function readStoredOrderAccessId(): string | null {
  try {
    return cleanValue(window.sessionStorage.getItem(ORDER_ACCESS_ID_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

export function storeOrderAccessId(accessId: string): void {
  const normalizedAccessId = cleanValue(accessId);
  if (!normalizedAccessId) {
    throw new Error('Seje za prikaz potrditve ni bilo mogoče ustvariti.');
  }

  try {
    window.sessionStorage.setItem(ORDER_ACCESS_ID_STORAGE_KEY, normalizedAccessId);
  } catch {
    throw new Error(
      'Brskalnik ni dovolil varne seje. Omogočite shranjevanje podatkov za to stran in poskusite znova.'
    );
  }
}

export async function exchangeOrderAccessToken(
  token: string
): Promise<OrderAccessSession> {
  const normalizedToken = cleanValue(token);
  if (!normalizedToken) {
    throw new Error('Povezava za prikaz potrditve ni veljavna.');
  }

  const response = await fetch(ORDER_ACCESS_SESSION_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: normalizedToken })
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
        : 'Varne seje za prikaz potrditve ni bilo mogoče ustvariti.'
    );
  }

  const accessId = cleanValue(record.accessId);
  if (!accessId) {
    throw new Error('Varne seje za prikaz potrditve ni bilo mogoče ustvariti.');
  }

  storeOrderAccessId(accessId);
  return {
    accessId,
    expiresAt: cleanValue(record.expiresAt) || null
  };
}
