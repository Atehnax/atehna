'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingInput } from '@/shared/ui/floating-field';

export default function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Prijava ni uspela.');
      }

      router.push('/admin/orders');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prijava ni uspela.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-20px_rgba(15,23,42,0.5)]">
      <h1 className="text-2xl font-semibold text-slate-900">Admin prijava</h1>
      <p className="mt-1 text-sm text-slate-500">Prijavite se za dostop do administracije.</p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <FloatingInput
          id="admin-username"
          tone="admin"
          label="Uporabniško ime"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />

        <FloatingInput
          id="admin-password"
          tone="admin"
          type="password"
          label="Geslo"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#5d3ed6] px-4 text-sm font-semibold text-white transition hover:bg-[#4b30b6] disabled:opacity-60"
        >
          {isSubmitting ? 'Prijava ...' : 'Prijava'}
        </button>
      </form>
    </div>
  );
}
