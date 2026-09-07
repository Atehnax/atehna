'use client';

import { useState } from 'react';
import type { BusinessAnalyticsSettings } from '@/shared/domain/analytics/businessSettings';
import { localDate } from '@/shared/domain/analytics/period';
import { readAnalyticsJson } from '@/shared/client/readAnalyticsJson';
import { adminAnalyticsControlClassName, adminAnalyticsPanelClassName, buttonTokenClasses } from '@/shared/ui/theme/tokens';

export default function BusinessQuoteSettings({ settings, onSaved }: { settings: BusinessAnalyticsSettings; onSaved(): void }) {
  const [date, setDate] = useState(settings.quoteGoLiveDate ?? '');
  const [revision, setRevision] = useState(settings.revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = (date || null) !== settings.quoteGoLiveDate;
  return <details id="quote-analytics-settings" className={adminAnalyticsPanelClassName} open={!settings.quoteGoLiveDate || undefined}>
    <summary className="cursor-pointer text-sm font-semibold">Začetek analitike povpraševanj in ponudb{settings.quoteGoLiveDate ? ` · ${settings.quoteGoLiveDate}` : ' · datum ni nastavljen'}</summary>
    <p className="mt-3 text-xs leading-relaxed text-slate-600">Izberite dejanski datum začetka uporabe. Povpraševanja štejemo po prejemu, ponudbe po prvi izdaji od tega datuma. Pravi spletni in ročni vnosi se upoštevajo; testni in zgodovinski ne. Zgodovinskih ponudb ne ustvarjamo. Nastavitev ne omejuje zgodovine naročil.</p>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={async event => {
      event.preventDefault(); setSaving(true); setError('');
      try {
        const response = await fetch('/api/admin/analytics/business/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteGoLiveDate: date || null, expectedRevision: revision }) });
        if (response.status === 409) {
          const conflict = await readAnalyticsJson<{ current?: BusinessAnalyticsSettings }>({ ok: true, status: response.status, headers: response.headers, json: () => response.json() }, 'Spremembe nastavitve ni mogoče preveriti.');
          if (conflict.current) setRevision(conflict.current.revision);
          throw new Error(`Nastavitev se je medtem spremenila. Trenutno shranjen datum: ${conflict.current?.quoteGoLiveDate ?? 'ni nastavljen'}. Vaš vnos je ohranjen.`);
        }
        await readAnalyticsJson<BusinessAnalyticsSettings>(response, 'Datuma začetka ni mogoče shraniti.');
        onSaved();
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Datuma začetka ni mogoče shraniti.'); } finally { setSaving(false); }
    }}>
      <label className="grid gap-1 text-xs font-medium text-slate-600">Datum začetka<input aria-label="Datum začetka analitike ponudb" type="date" max={localDate(new Date())} value={date} disabled={saving} className={adminAnalyticsControlClassName} onChange={event => setDate(event.target.value)} /></label>
      <button type="submit" className={buttonTokenClasses.control} disabled={saving || !dirty}>{saving ? 'Shranjujem …' : 'Shrani datum začetka'}</button>
      {!settings.quoteGoLiveDate && <span className="text-xs text-amber-800" role="status">Analitika povpraševanj in ponudb čaka na nastavitev datuma.</span>}
    </form>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </details>;
}
