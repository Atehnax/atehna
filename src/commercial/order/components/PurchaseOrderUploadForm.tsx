'use client';

import { useState } from 'react';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];

type PurchaseOrderUploadFormProps = {
  initialOrderId?: string;
  initialOrderNumber?: string;
  accessToken?: string;
};

export default function PurchaseOrderUploadForm({
  initialOrderId,
  initialOrderNumber,
  accessToken
}: PurchaseOrderUploadFormProps) {
  const [orderNumber, setOrderNumber] = useState(
    initialOrderNumber || initialOrderId || ''
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const hasAccess = Boolean(accessToken?.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUploadedUrl(null);

    const normalizedOrderNumber = (
      initialOrderId ||
      orderNumber
    ).trim();
    if (!normalizedOrderNumber) {
      setMessage('Vnesite veljavno številko naročila.');
      return;
    }
    if (!hasAccess) {
      setMessage(
        'Povezava za nalaganje ni veljavna. Uporabite povezavo iz potrditve naročila.'
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
    formData.append('accessToken', accessToken?.trim() ?? '');

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(normalizedOrderNumber)}/purchase-order`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken?.trim() ?? ''}`
          },
          body: formData
        }
      );
      const payload: unknown = await response.json().catch(() => ({}));
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
      setMessage('Naročilnica je uspešno shranjena.');
      form.reset();
      setSelectedFileName('');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Napaka pri nalaganju datoteke.'
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
          htmlFor="orderNumber"
        >
          Številka naročila
        </label>
        <input
          id="orderNumber"
          className="site-field w-full"
          value={orderNumber}
          readOnly={Boolean(initialOrderNumber || initialOrderId)}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="npr. #123"
          autoComplete="off"
        />
      </div>

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
          onChange={(event) =>
            setSelectedFileName(event.target.files?.[0]?.name ?? '')
          }
        />
        <label
          htmlFor="purchaseOrder"
          className="site-radius-md flex min-h-16 cursor-pointer items-center gap-3 border border-dashed border-[color:var(--site-border-color)] bg-[color:var(--site-color-surface-muted)] px-4 transition hover:border-[color:var(--site-color-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--site-field-focus)]"
        >
          <span className="site-button site-button--secondary pointer-events-none inline-flex shrink-0 items-center justify-center">
            Izberi datoteko
          </span>
          <span className="min-w-0 truncate text-sm text-[color:var(--site-color-text-muted)]">
            {selectedFileName || 'PDF ali JPG, največ 10 MB'}
          </span>
        </label>
      </div>

      {!hasAccess ? (
        <p
          role="alert"
          className="site-radius-sm border border-[color:var(--site-color-warning)] bg-[color:var(--site-color-surface-muted)] p-3 text-sm"
        >
          Zaradi varnosti je naročilnico mogoče naložiti samo prek povezave v
          potrditvi naročila.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !hasAccess}
        className="site-button site-button--primary inline-flex w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isSubmitting ? 'Nalaganje …' : 'Naloži naročilnico'}
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
