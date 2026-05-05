'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PlotParams } from 'react-plotly.js';

const Plot = dynamic(
  async () => {
    const [{ default: createPlotlyComponent }, { default: Plotly }] = await Promise.all([
      import('react-plotly.js/factory'),
      import('plotly.js-basic-dist-min')
    ]);
    return createPlotlyComponent(Plotly);
  },
  { ssr: false }
) as ComponentType<PlotParams>;

export default Plot;
