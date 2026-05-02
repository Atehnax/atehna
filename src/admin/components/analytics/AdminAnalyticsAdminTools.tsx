'use client';

import dynamic from 'next/dynamic';
import type { DragEndEvent } from '@dnd-kit/core';
import LazyConfirmDialog from '@/shared/ui/confirm-dialog/lazy-confirm-dialog';
import type { ChartTheme } from '@/admin/components/charts/chartTheme';
import type { OrdersAnalyticsResponse } from '@/shared/server/orderAnalytics';
import type { AnalyticsChartConfig, AnalyticsChartType, AnalyticsGlobalAppearance } from '@/shared/server/analyticsCharts';

const LazyBuilderModal = dynamic(() => import('@/admin/components/analytics/AnalyticsBuilderModal'), { ssr: false });
const LazyAppearancePanel = dynamic(() => import('@/admin/components/analytics/AnalyticsAppearancePanel'), { ssr: false });
const LazySortableGrid = dynamic(() => import('@/admin/components/analytics/AnalyticsSortableGrid'), { ssr: false });

export default function AdminAnalyticsAdminTools(props: {
  showAppearance: boolean;
  reorderMode: boolean;
  builderOpen: boolean;
  confirmDeleteChartId: number | null;
  setConfirmDeleteChartId: (id: number | null) => void;
  onConfirmDelete: () => void;
  appearance: AnalyticsGlobalAppearance;
  savedAppearance: AnalyticsGlobalAppearance;
  onChangeAppearance: (appearance: AnalyticsGlobalAppearance) => void;
  onSaveAppearance: () => Promise<void>;
  onResetAppearance: () => void;
  builder: {
    title: string;
    description: string;
    comment: string;
    chartType: AnalyticsChartType;
    config: AnalyticsChartConfig;
    mode: 'create' | 'edit';
    onChangeTitle: (v: string) => void;
    onChangeDescription: (v: string) => void;
    onChangeComment: (v: string) => void;
    onChangeChartType: (v: AnalyticsChartType) => void;
    onChangeConfig: (v: AnalyticsChartConfig) => void;
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
  };
  data: OrdersAnalyticsResponse;
  chartTheme: ChartTheme;
  sortable?: {
    ids: number[];
    onDragEnd: (event: DragEndEvent) => void;
    renderItem: (id: number) => React.ReactNode;
  };
}) {
  return (
    <>
      {props.showAppearance ? (
        <LazyAppearancePanel
          appearance={props.appearance}
          savedAppearance={props.savedAppearance}
          onChange={props.onChangeAppearance}
          onSave={props.onSaveAppearance}
          onReset={props.onResetAppearance}
        />
      ) : null}

      {props.reorderMode && props.sortable ? (
        <LazySortableGrid ids={props.sortable.ids} onDragEnd={props.sortable.onDragEnd} renderItem={props.sortable.renderItem} />
      ) : null}

      {props.builderOpen ? (
        <LazyBuilderModal
          title={props.builder.title}
          description={props.builder.description}
          comment={props.builder.comment}
          chartType={props.builder.chartType}
          config={props.builder.config}
          data={props.data}
          onChangeTitle={props.builder.onChangeTitle}
          onChangeDescription={props.builder.onChangeDescription}
          onChangeComment={props.builder.onChangeComment}
          onChangeChartType={props.builder.onChangeChartType}
          onChangeConfig={props.builder.onChangeConfig}
          onClose={props.builder.onClose}
          onSave={props.builder.onSave}
          chartTheme={props.chartTheme}
          mode={props.builder.mode}
          onDelete={props.builder.onDelete}
          appearance={props.appearance}
        />
      ) : null}

      <LazyConfirmDialog
        open={props.confirmDeleteChartId !== null}
        title="Izbris grafa"
        description="Ali res želite izbrisati ta graf?"
        confirmLabel="Izbriši"
        cancelLabel="Prekliči"
        isDanger
        onCancel={() => props.setConfirmDeleteChartId(null)}
        onConfirm={props.onConfirmDelete}
      />
    </>
  );
}
