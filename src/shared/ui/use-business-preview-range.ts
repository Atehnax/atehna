'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BusinessAnalyticsResponse } from '@/shared/domain/analytics/businessAnalytics';

type PreviewRequest<Summary> = {
  range: string;
  asOf: string;
  summary: Summary | null;
  failed: boolean;
};

/** Reuses the server's 90-day preview and fetches every other period canonically. */
export function useBusinessPreviewRange<Summary extends Record<string, number | null>>(
  initial: Summary,
  asOf: string,
  project: (response: BusinessAnalyticsResponse) => Summary
) {
  const [range, setRange] = useState('90D');
  const [attempt, setAttempt] = useState(0);
  const [request, setRequest] = useState<PreviewRequest<Summary> | null>(null);

  useEffect(() => {
    if (range === '90D') return;
    const controller = new AbortController();
    const query = new URLSearchParams({ range, asOf });

    async function load() {
      setRequest({ range, asOf, summary: null, failed: false });
      try {
        const response = await fetch('/api/admin/analytics/business?' + query, {
          signal: controller.signal,
          cache: 'no-store'
        });
        if (!response.ok) throw new Error('Analytics request failed');
        const result = await response.json() as BusinessAnalyticsResponse;
        if (result.period?.range !== range || result.asOf !== asOf) {
          throw new Error('Analytics period does not match the selection');
        }
        const summary = project(result);
        if (Object.values(summary).some(value => value !== null && (
          typeof value !== 'number' || !Number.isFinite(value)
        ))) throw new Error('Analytics summary is incomplete');
        if (!controller.signal.aborted) setRequest({ range, asOf, summary, failed: false });
      } catch {
        if (!controller.signal.aborted) {
          setRequest({ range, asOf, summary: null, failed: true });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [range, asOf, project, attempt]);

  const matching = request?.range === range && request.asOf === asOf ? request : null;
  const summary = range === '90D' ? initial : matching?.summary ?? null;
  const failed = range !== '90D' && (matching?.failed ?? false);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  return { range, setRange, summary, loading: summary === null && !failed, failed, retry };
}

export function businessPreviewHref(view: 'narocila' | 'ponudbe', range: string, asOf: string) {
  return '/admin/analitika?' + new URLSearchParams({ view, range, asOf });
}
