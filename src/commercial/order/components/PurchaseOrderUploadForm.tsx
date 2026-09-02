'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  consumeOrderAccessTokenFromLocation,
  exchangeOrderAccessToken,
  readStoredOrderAccessId
} from '@/commercial/order/orderAccessClient';
import { readJsonResponse } from '@/shared/client/readJsonResponse';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];
const formatFileSize = (size: number) =>
  new Intl.NumberFormat('sl-SI', {
    maximumFractionDigits: 1
  }).format(size / (1024 * 1024));

type AccessState =
  | { status: 'loading' }
  | { status: 'ready'; accessId: string }
  | { status: 'error'; message: string; canUseFragmentFallback?: boolean };

export default function PurchaseOrderUploadForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
  } | null>(null);
  const [accessState, setAccessState] = useState<AccessState>({
    status: 'loading'
  });
  const bootstrapTokenRef = useRef<string | null>(null);
  const locationTokenConsumedRef = useRef(false);
  const hasAccess = accessState.status === 'ready';

  const loadAccessSession = useCallback(async () => {
    setAccessState({ status: 'loading' });
    try {
      if (!locationTokenConsumedRef.current) {
        bootstrapTokenRef.current = consumeOrderAccessTokenFromLocation();
        locationTokenConsumedRef.current = true;
      }

      let accessId = readStoredOrderAccessId();
      if (bootstrapTokenRef.current) {
        const session = await exchangeOrderAccessToken(
          bootstrapTokenRef.current
        );
        accessId = session.accessId;
        bootstrapTokenRef.current = null;
      }
      if (!accessId) {
        throw new Error(
          'Povezava za nalaganje ni veljavna. Uporabite varno povezavo iz e-pošte ali potrditve naročila.'
        );
      }

      setAccessState({ status: 'ready', accessId });
    } catch (error) {
      setAccessState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Varne seje za nalaganje ni bilo mogoče ustvariti.',
        canUseFragmentFallback: Boolean(bootstrapTokenRef.current)
      });
    }
  }, []);

  useEffect(() => {
    void loadAccessSession();
  }, [loadAccessSession]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUploadedUrl(null);

    if (accessState.status !== 'ready') {
      setMessage(
        'Povezava za nalaganje ni veljavna. Uporabite varno povezavo iz e-pošte ali potrditve naročila.'
      );
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem(
      'purchaseOrder'
    ) as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      setMessage('Izberite datoteko za nalaganje.');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage('Dovoljeni so PDF ali JPG.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setMessage('Datoteka je prevelika (največ 10 MB).');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/orders/purchase-order', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-Order-Access-Id': accessState.accessId
        },
        body: formData
      });
      const payload: unknown = await readJsonResponse(response, {});
      if (!response.ok) {
        const record =
          typeof payload === 'object' && payload !== null
            ? (payload as Record<string, unknown>)
            : {};
        throw new Error(
          typeof record.message === 'string'
            ? record.message
            : 'Nalaganje ni uspelo.'
        );
      }

      const result = payload as { url?: string };
      setUploadedUrl(result.url ?? null);
      setMessage(
        'Naročilnica je uspešno naložena in povezana z vašim naročilom.'
      );
      form.reset();
      setSelectedFile(null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Napaka pri nalaganju datoteke.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-[color:var(--site-color-text)]"
          htmlFor="purchaseOrder"
        >
          Datoteka naročilnice
        </label>
        <input
          id="purchaseOrder"
          name="purchaseOrder"
          type="file"
          accept="application/pdf,image/jpeg"
          className="peer sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setSelectedFile(file ? { name: file.name, size: file.size } : null);
          }}
        />
        <label
          htmlFor="purchaseOrder"
          className="site-radius-md flex min-h-16 cursor-pointer items-center gap-3 border border-dashed border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] px-4 transition hover:border-[color:var(--site-color-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--site-field-focus)]"
        >
          <span className="site-button site-button--secondary pointer-events-none inline-flex shrink-0 items-center justify-center">
            {selectedFile ? 'Zamenjaj datoteko' : 'Izberi datoteko'}
          </span>
          {selectedFile ? (
            <span className="min-w-0 text-sm">
              <span className="block truncate font-semibold text-[color:var(--site-color-text)]">
                {selectedFile.name}
              </span>
              <span className="block text-xs text-[color:var(--site-color-text-muted)]">
                {formatFileSize(selectedFile.size)} MB
              </span>
            </span>
          ) : (
            <span className="min-w-0 truncate text-sm text-[color:var(--site-color-text-muted)]">
              Podpisan PDF ali JPG, največ 10 MB
            </span>
          )}
        </label>
      </div>

      {accessState.status === 'loading' ? (
        <p
          role="status"
          className="site-radius-sm border border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] p-3 text-sm"
        >
          Preverjamo varno povezavo …
        </p>
      ) : null}

      {accessState.status === 'error' ? (
        <p
          role="alert"
          className="site-radius-sm border border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface-muted)] p-3 text-sm"
        >
          {accessState.message}
        </p>
      ) : null}

      {accessState.status === 'error' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="site-button site-button--secondary"
            onClick={() => void loadAccessSession()}
          >
            Poskusi znova
          </button>
          {accessState.canUseFragmentFallback ? (
            <button
              type="button"
              className="site-button site-button--secondary inline-flex items-center justify-center"
              onClick={() => {
                const accessToken = bootstrapTokenRef.current;
                if (!accessToken) return;
                const fallbackUrl = `${window.location.pathname}${window.location.search}#token=${encodeURIComponent(
                  accessToken
                )}`;
                window.history.replaceState(
                  window.history.state,
                  '',
                  fallbackUrl
                );
                window.location.reload();
              }}
            >
              Ponovno odpri varno povezavo
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !hasAccess}
        className="site-button site-button--primary inline-flex w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isSubmitting ? 'Varno nalaganje …' : 'Naloži naročilnico'}
      </button>

      {message ? (
        <p
          role="status"
          className="text-sm text-[color:var(--site-color-text-muted)]"
        >
          {message}
        </p>
      ) : null}
      {uploadedUrl ? (
        <a
          href={uploadedUrl}
          target="_blank"
          rel="noreferrer"
          className="site-link inline-flex text-sm font-semibold"
        >
          Odpri naloženo naročilnico →
        </a>
      ) : null}
    </form>
  );
}
