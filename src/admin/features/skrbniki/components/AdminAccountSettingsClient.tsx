"use client";

import { useState, type FormEvent } from 'react';
import { AdminPageHeader } from '@/shared/ui/admin-primitives';
import { AdminTablePrimaryActionButton, adminWindowCardClassName } from '@/shared/ui/admin-table';
import { FloatingInput } from '@/shared/ui/floating-field';
import { AdminUnitInput } from '@/shared/ui/admin-controls/AdminUnitInput';
import { Spinner } from '@/shared/ui/loading';
import { ADMIN_SESSION_CHANGED_EVENT } from '@/admin/components/adminSessionActivity';

type SessionPolicy = { maxLifetimeDays: number; idleTimeoutMinutes: number };
type SettingsResponse = { message?: string; error?: string; requiresLogin?: boolean };

function UsernameField({ username }: { username: string }) {
  return <input className="sr-only" type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-label="Uporabniško ime" />;
}

export default function AdminAccountSettingsClient({ username, initialPolicy }: {
  username: string;
  initialPolicy: SessionPolicy;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [policyPassword, setPolicyPassword] = useState('');
  const [maxLifetimeDays, setMaxLifetimeDays] = useState(String(initialPolicy.maxLifetimeDays));
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(String(initialPolicy.idleTimeoutMinutes));
  const [savedPolicy, setSavedPolicy] = useState(initialPolicy);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<'password' | 'policy' | null>(null);
  const policyChanged = Number(maxLifetimeDays) !== savedPolicy.maxLifetimeDays || Number(idleTimeoutMinutes) !== savedPolicy.idleTimeoutMinutes;

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setPasswordError(null);
    if (newPassword.length < 12 || newPassword.length > 128) {
      setPasswordError('Novo geslo mora vsebovati od 12 do 128 znakov.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Novi gesli se ne ujemata.');
      return;
    }
    setSaving('password');
    try {
      const response = await fetch('/api/admin/skrbniki/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      if (response.status === 401) { window.location.replace('/admin'); return; }
      const payload = await response.json().catch(() => ({})) as SettingsResponse;
      if (!response.ok) throw new Error(payload.error || 'Gesla ni bilo mogoče spremeniti.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      window.location.replace('/admin?passwordChanged=1');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Gesla ni bilo mogoče spremeniti.');
    } finally { setSaving(null); }
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setPolicyError(null); setPolicyNotice(null);
    const maxDays = Number(maxLifetimeDays);
    const idleMinutes = Number(idleTimeoutMinutes);
    if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 90 || !Number.isInteger(idleMinutes) || idleMinutes < 1 || idleMinutes > 1440) {
      setPolicyError('Vnesite celo število od 1 do 90 dni in od 1 do 1440 minut.');
      return;
    }
    setSaving('policy');
    try {
      const response = await fetch('/api/admin/skrbniki/session-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: policyPassword, maxLifetimeDays: maxDays, idleTimeoutMinutes: idleMinutes })
      });
      if (response.status === 401) { window.location.replace('/admin'); return; }
      const payload = await response.json().catch(() => ({})) as SettingsResponse;
      if (!response.ok) throw new Error(payload.error || 'Nastavitev sej ni bilo mogoče shraniti.');
      setPolicyPassword('');
      if (payload.requiresLogin) { window.location.replace('/admin'); return; }
      setSavedPolicy({ maxLifetimeDays: maxDays, idleTimeoutMinutes: idleMinutes });
      setPolicyNotice(payload.message || 'Nastavitve sej so shranjene.');
      window.dispatchEvent(new Event(ADMIN_SESSION_CHANGED_EVENT));
    } catch (error) {
      setPolicyError(error instanceof Error ? error.message : 'Nastavitev sej ni bilo mogoče shraniti.');
    } finally { setSaving(null); }
  }

  return (
    <div className="w-full space-y-4 font-['Inter',system-ui,sans-serif]">
      <AdminPageHeader title="Skrbniki" description={`Geslo in trajanje prijave za ${username}.`} />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <section className={`${adminWindowCardClassName} p-5`} aria-labelledby="admin-password-heading">
          <h2 id="admin-password-heading" className="text-sm font-semibold text-slate-900">Sprememba gesla</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Po spremembi gesla se ponovno prijavite. Vse obstoječe prijave bodo odjavljene.</p>
          <form className="mt-4" onSubmit={savePassword} aria-label="Sprememba gesla">
            <UsernameField username={username} />
            <fieldset disabled={saving !== null} className="space-y-3">
              <FloatingInput id="account-current-password" name="currentPassword" tone="admin" label="Trenutno geslo" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <FloatingInput id="account-new-password" name="newPassword" tone="admin" label="Novo geslo" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-describedby="account-password-length" />
              <FloatingInput id="account-confirm-password" name="confirmPassword" tone="admin" label="Potrditev novega gesla" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <p id="account-password-length" className="text-xs text-slate-500">Od 12 do 128 znakov.</p>
              {passwordError ? <p role="alert" className="text-xs leading-5 text-rose-700">{passwordError}</p> : null}
              <AdminTablePrimaryActionButton type="submit" disabled={saving !== null} className="gap-2">
                {saving === 'password' ? <Spinner size="sm" /> : null}
                {saving === 'password' ? 'Shranjujem …' : 'Spremeni geslo'}
              </AdminTablePrimaryActionButton>
            </fieldset>
          </form>
        </section>

        <section className={`${adminWindowCardClassName} p-5`} aria-labelledby="admin-session-heading">
          <h2 id="admin-session-heading" className="text-sm font-semibold text-slate-900">Nastavitve sej</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Prijava se konča ob poteku najdaljšega trajanja ali po obdobju neaktivnosti.</p>
          <form className="mt-4" onSubmit={savePolicy} aria-label="Nastavitve sej">
            <UsernameField username={username} />
            <fieldset disabled={saving !== null} className="space-y-3">
              <div className="grid gap-3">
                <div>
                  <label htmlFor="session-max-lifetime" className="mb-1 block text-xs font-medium text-slate-600">Najdaljše trajanje seje</label>
                  <AdminUnitInput id="session-max-lifetime" name="maxLifetimeDays" type="number" unit="dni" required min={1} max={90} step={1} value={maxLifetimeDays} onChange={(event) => setMaxLifetimeDays(event.target.value)} aria-describedby="session-max-lifetime-hint" />
                  <p id="session-max-lifetime-hint" className="mt-1 text-[11px] text-slate-500">Od 1 do 90 dni.</p>
                </div>
                <div>
                  <label htmlFor="session-idle-timeout" className="mb-1 block text-xs font-medium text-slate-600">Odjava zaradi neaktivnosti</label>
                  <AdminUnitInput id="session-idle-timeout" name="idleTimeoutMinutes" type="number" unit="min" required min={1} max={1440} step={1} value={idleTimeoutMinutes} onChange={(event) => setIdleTimeoutMinutes(event.target.value)} aria-describedby="session-idle-timeout-hint" />
                  <p id="session-idle-timeout-hint" className="mt-1 text-[11px] text-slate-500">Od 1 do 1440 minut.</p>
                </div>
              </div>
              <FloatingInput id="session-current-password" name="currentPassword" tone="admin" label="Trenutno geslo" type="password" autoComplete="current-password" required value={policyPassword} onChange={(event) => setPolicyPassword(event.target.value)} />
              {policyError ? <p role="alert" className="text-xs leading-5 text-rose-700">{policyError}</p> : null}
              {policyNotice ? <p role="status" className="text-xs leading-5 text-emerald-700">{policyNotice}</p> : null}
              <AdminTablePrimaryActionButton type="submit" disabled={saving !== null || !policyChanged} className="gap-2">
                {saving === 'policy' ? <Spinner size="sm" /> : null}
                {saving === 'policy' ? 'Shranjujem …' : 'Shrani nastavitve'}
              </AdminTablePrimaryActionButton>
            </fieldset>
          </form>
        </section>
      </div>
    </div>
  );
}
