'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PlotParams } from 'react-plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false
}) as ComponentType<PlotParams>;

export default Plot;
