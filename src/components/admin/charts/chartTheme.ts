'use client';

import type { Layout } from 'plotly.js';

export type ChartTheme = {
  canvas: string;
  card: string;
  border: string;
  text: string;
  mutedText: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  series: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
    danger: string;
    neutral: string;
  };
};

const fallbackTheme: ChartTheme = {
  canvas: '#f3f4f6',
  card: '#ffffff',
  border: '#d1d5db',
  text: '#1f2937',
  mutedText: '#4b5563',
  grid: 'rgba(209, 213, 219, 0.5)',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d1d5db',
  series: {
    primary: '#2563eb',
    secondary: '#0ea5e9',
    tertiary: '#14b8a6',
    quaternary: '#f59e0b',
    danger: '#ef4444',
    neutral: '#0284c7'
  }
};

const readVar = (styles: CSSStyleDeclaration, variable: string, fallback: string) =>
  styles.getPropertyValue(variable).trim() || fallback;

export function getChartThemeFromCssVars(): ChartTheme {
  if (typeof window === 'undefined') return fallbackTheme;
  const styles = getComputedStyle(document.documentElement);

  return {
    canvas: readVar(styles, '--chart-canvas', fallbackTheme.canvas),
    card: readVar(styles, '--chart-card', fallbackTheme.card),
    border: readVar(styles, '--chart-border', fallbackTheme.border),
    text: readVar(styles, '--chart-text', fallbackTheme.text),
    mutedText: readVar(styles, '--chart-muted-text', fallbackTheme.mutedText),
    grid: readVar(styles, '--chart-grid', fallbackTheme.grid),
    tooltipBg: readVar(styles, '--chart-tooltip-bg', fallbackTheme.tooltipBg),
    tooltipBorder: readVar(styles, '--chart-tooltip-border', fallbackTheme.tooltipBorder),
    series: {
      primary: readVar(styles, '--chart-series-primary', fallbackTheme.series.primary),
      secondary: readVar(styles, '--chart-series-secondary', fallbackTheme.series.secondary),
      tertiary: readVar(styles, '--chart-series-tertiary', fallbackTheme.series.tertiary),
      quaternary: readVar(styles, '--chart-series-quaternary', fallbackTheme.series.quaternary),
      danger: readVar(styles, '--chart-series-danger', fallbackTheme.series.danger),
      neutral: readVar(styles, '--chart-series-neutral', fallbackTheme.series.neutral)
    }
  };
}

export function getBaseChartLayout(theme: ChartTheme): Partial<Layout> {
  return {
    autosize: true,
    paper_bgcolor: theme.card,
    plot_bgcolor: theme.card,
    margin: { l: 56, r: 24, t: 20, b: 44 },
    hovermode: 'x unified',
    font: {
      family: 'Inter, ui-sans-serif, system-ui, sans-serif',
      color: theme.text,
      size: 12
    },
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.12,
      font: { color: theme.mutedText, size: 11 }
    },
    hoverlabel: {
      bgcolor: theme.tooltipBg,
      bordercolor: theme.tooltipBorder,
      font: { color: theme.text }
    }
  };
}
