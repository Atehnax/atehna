'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PlotParams } from 'react-plotly.js';
import { markRouteEvent } from '@/shared/client/routePerformance';

const Plot = dynamic(
  async () => {
    markRouteEvent('/admin/analitika', 'plotly-import-start');
    const [{ default: createPlotlyComponent }, { default: Plotly }] = await Promise.all([
      import('react-plotly.js/factory'),
      import('plotly.js-basic-dist-min')
    ]);
    markRouteEvent('/admin/analitika', 'plotly-import-resolved');
    return createPlotlyComponent(Plotly);
  },
  { ssr: false }
) as ComponentType<PlotParams>;

export default Plot;
