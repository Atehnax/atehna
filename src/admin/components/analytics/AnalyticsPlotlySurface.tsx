'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { Data, Layout } from 'plotly.js';
import { markRouteEvent, measureRouteDuration } from '@/shared/client/routePerformance';

const LazyPlotlyClient = dynamic(() => import('@/admin/components/charts/PlotlyClient'), {
  ssr: false
});

export default function AnalyticsPlotlySurface({
  data,
  layout,
  onClick
}: {
  data: Data[];
  layout: Partial<Layout>;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasMarkedFirstRenderRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={containerRef} className="min-h-[300px]">
      {visible ? (
        <LazyPlotlyClient
          data={data}
          layout={layout}
          config={{ responsive: true, displayModeBar: true }}
          useResizeHandler
          style={{ width: '100%', height: 300 }}
          onClick={onClick}
          onAfterPlot={() => {
            if (hasMarkedFirstRenderRef.current) return;
            hasMarkedFirstRenderRef.current = true;
            markRouteEvent('/admin/analitika', 'first-chart-render-complete');
            measureRouteDuration('/admin/analitika', 'plotly-import-to-first-chart-render', 'plotly-import-start', 'first-chart-render-complete');
          }}
        />
      ) : (
        <div className="h-[300px] animate-pulse rounded bg-slate-100" />
      )}
    </div>
  );
}
