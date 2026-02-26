'use client';

import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import TextField from '@mui/material/TextField';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg'];


const outlinedTextFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fff',
    boxShadow: 'none',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#cbd5e1',
      borderWidth: 1
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#94a3b8'
    },
    '&.Mui-focused': {
      boxShadow: 'none'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#5d3ed6',
      borderWidth: 1
    }
  },
  '& .MuiInputBase-input:focus-visible': {
    outline: 'none',
    boxShadow: 'none'
  },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    backgroundColor: '#fff',
    paddingInline: '4px'
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#5d3ed6'
  }
} as const;

export default function PurchaseOrderUploadForm() {
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setUploadedUrl(null);

    const normalizedOrderNumber = orderNumber.trim();
    if (!normalizedOrderNumber) {
      setMessage('Vnesite veljavno številko naročila (npr. #123, 123).');
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
      const response = await fetch(`/api/orders/${encodeURIComponent(normalizedOrderNumber)}/purchase-order`, {
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
      <TextField
        sx={outlinedTextFieldSx}
        id="orderNumber"
        label="Št. naročila"
        variant="outlined"
        size="small"
        fullWidth
        value={orderNumber}
        onChange={(event) => setOrderNumber(event.target.value)}
      />
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
      <Button type="submit" disabled={isSubmitting} variant="brand" size="sm">
        {isSubmitting ? 'Nalaganje...' : 'Naloži naročilnico'}
      </Button>
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
