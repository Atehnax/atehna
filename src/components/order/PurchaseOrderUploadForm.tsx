'use client';

import { useState } from 'react';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];

function parseOrderId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) {
    const numeric = trimmed.slice(1);
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (trimmed.toUpperCase().startsWith('N-')) {
    const numeric = trimmed.slice(trimmed.indexOf('-') + 1);
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PurchaseOrderUploadForm() {
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUploadedUrl(null);

    const orderId = parseOrderId(orderNumber);
    if (!orderId) {
      setMessage('Vnesite veljavno številko naročila (npr. #123).');
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem('purchaseOrder') as HTMLInputElement | null;
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
      const response = await fetch(`/api/orders/${orderId}/purchase-order`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Nalaganje ni uspelo.');
      }
      const payload = (await response.json()) as { url: string };
      setUploadedUrl(payload.url);
      setMessage('Naročilnica je uspešno shranjena.');
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Napaka pri nalaganju datoteke.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="orderNumber">
          Št. naročila
        </label>
        <input
          id="orderNumber"
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="#123"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="purchaseOrder">
          Datoteka naročilnice (PDF ali JPG)
        </label>
        <input
          id="purchaseOrder"
          name="purchaseOrder"
          type="file"
          accept="application/pdf,image/jpeg"
          className="mt-1 block w-full text-sm text-slate-600"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isSubmitting ? 'Nalaganje...' : 'Naloži naročilnico'}
      </button>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {uploadedUrl && (
        <a
          href={uploadedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Odpri naloženo naročilnico →
        </a>
      )}
    </form>
  );
}
