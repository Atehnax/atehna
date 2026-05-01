import type { CSSProperties } from 'react';
import {
  adminSearchPlaceholderTokenClasses,
  adminTextButtonTypographyTokenClasses
} from '@/shared/ui/theme/tokens';

export const adminTableCardClassName =
  'border shadow-[0_14px_34px_rgba(15,23,42,0.07),0_2px_6px_rgba(15,23,42,0.03)]';

export const adminTableCardStyle: CSSProperties = {
  background: '#fff',
  borderColor: '#e2e8f0'
};

export const adminWindowCardClassName =
  `${adminTableCardClassName} overflow-hidden rounded-2xl border-slate-200 bg-white`;

export const adminWindowCardStyle = adminTableCardStyle;

export const adminTableHeaderClassName = 'px-5 pt-5 pb-2 [&>div:last-child]:!mt-3';
export const adminTableContentClassName = 'overflow-x-auto bg-white';
export const adminTableToolbarGroupClassName = 'flex min-h-9 items-center gap-2';
export const adminTableToolbarActionsClassName = 'flex min-h-9 items-center gap-1.5 self-center';

export const adminTableSearchWrapperClassName =
  '!w-full min-w-0 h-9 !rounded-md border-slate-200/90 !bg-slate-50';

export const adminTableToolbarSearchWrapperClassName =
  `${adminTableSearchWrapperClassName} sm:!flex-none sm:!w-[50%] sm:min-w-[25rem] sm:max-w-[37.5rem]`;

export const adminTableSearchInputClassName =
  `!m-0 !h-full min-w-0 w-full flex-1 !rounded-md !border-0 !bg-transparent !pr-4 !text-[13px] !font-normal text-slate-700 !shadow-none !outline-none ring-0 transition-colors [--euiFormControlStateWidth:0px] focus:[--euiFormControlStateWidth:0px] focus-visible:[--euiFormControlStateWidth:0px] focus:!border-0 focus:!shadow-none focus:!outline-none focus-visible:!border-0 focus-visible:!shadow-none focus-visible:!outline-none ${adminSearchPlaceholderTokenClasses}`;

export const adminTableSearchIconClassName = 'left-4 h-[18px] w-[18px] text-slate-400';

export const adminTableNeutralIconButtonClassName =
  '!h-9 !w-9 !rounded-md !border-slate-200/90 !bg-white !text-slate-600 hover:!bg-slate-50 hover:!text-[#1982bf] active:!text-[#1982bf]';

export const adminTableSelectedSuccessIconButtonClassName =
  '!h-9 !w-9 !rounded-md !border-emerald-300/80 !bg-white !text-emerald-700 hover:!bg-emerald-50 active:!bg-emerald-100 disabled:!border-slate-200 disabled:!bg-white disabled:!text-slate-300';

export const adminTableSelectedWarningIconButtonClassName =
  '!h-9 !w-9 !rounded-md !border-amber-300/80 !bg-white !text-amber-700 hover:!bg-amber-50 active:!bg-amber-100 disabled:!border-slate-200 disabled:!bg-white disabled:!text-slate-300';

export const adminTableSelectedDangerIconButtonClassName =
  '!h-9 !w-9 !rounded-md !border-rose-300/80 !bg-white !text-rose-700 hover:!bg-rose-50 active:!bg-rose-100 disabled:!border-slate-200 disabled:!bg-white disabled:!text-slate-300';

export const adminTablePrimaryButtonClassName =
  `${adminTextButtonTypographyTokenClasses} !h-9 !rounded-md !px-4 !text-[13px] !font-semibold !tracking-[0.005em] hover:!bg-[#1777af] active:!bg-[#146997]`;

export const adminTableHeaderButtonClassName =
  'inline-flex items-center text-[12px] font-semibold leading-none text-slate-900 transition-colors hover:text-[color:var(--blue-500)]';

export const adminTableBulkHeaderButtonClassName =
  'inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[12px] font-semibold leading-none text-slate-700 hover:bg-[color:var(--hover-neutral)] disabled:cursor-default disabled:text-slate-300';

export const adminTableHeaderTextClassName =
  'inline-flex items-center text-[12px] font-semibold leading-none text-slate-900';

export const adminTableHeaderCellBaseClassName =
  'h-11 border-b border-slate-200 px-3 py-0 align-middle text-[12px] font-semibold text-slate-700';

export const adminTableHeaderCellCenterClassName = `${adminTableHeaderCellBaseClassName} text-center`;

export const adminTableHeaderCellLeftClassName = `${adminTableHeaderCellBaseClassName} text-left`;

export const adminTableHeaderContentClassName =
  'relative inline-flex h-11 items-center gap-1.5 align-middle';

export const adminTableBodyCellBaseClassName =
  'h-12 px-3 py-0 align-middle text-[12px] text-slate-700';

export const adminTableBodyCellCenterClassName = `${adminTableBodyCellBaseClassName} text-center`;

export const adminTableBodyCellLeftClassName = `${adminTableBodyCellBaseClassName} text-left`;

export const adminTableRowHeightClassName = 'h-12';

export const adminTableMatchingValueBaseClassName =
  'inline-flex items-center rounded-[4px] border border-transparent px-1 leading-[1.35]';

export const adminTableMatchingValueActiveClassName =
  'border-dashed !border-amber-500/80 bg-amber-100/70';

export const adminTableMatchingValueClassName =
  `${adminTableMatchingValueBaseClassName} ${adminTableMatchingValueActiveClassName}`;

export const adminTableMatchingValueHeaderStartClassName = 'ml-[5px]';

export const adminTableInlineEditInputClassName =
  "h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] leading-7 text-slate-900 shadow-none outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0";

export const adminTableInlineActionRowClassName = 'flex items-center justify-center gap-1 whitespace-nowrap';

export const adminTableInlineConfirmButtonClassName =
  '!h-[26px] !w-[26px] !rounded-md !border !border-slate-200 !bg-white !p-0 !text-emerald-600/70 !shadow-none hover:!border-emerald-300 hover:!bg-emerald-50 hover:!text-emerald-700 active:!border-emerald-300 active:!bg-emerald-50 active:!text-emerald-700 disabled:!border-slate-200 disabled:!bg-white disabled:!text-slate-300 disabled:!opacity-100';

export const adminTableInlineCancelButtonClassName =
  '!h-[26px] !w-[26px] !rounded-md !border !border-slate-200 !bg-white !p-0 !text-rose-600/70 !shadow-none hover:!border-rose-300 hover:!bg-rose-50 hover:!text-rose-700 active:!border-rose-300 active:!bg-rose-50 active:!text-rose-700 disabled:!border-slate-200 disabled:!bg-white disabled:!text-slate-300 disabled:!opacity-100';

export const adminTableInlineConfirmIconClassName = '!h-4 !w-4';
export const adminTableInlineCancelIconClassName = '!h-[13px] !w-[13px]';

export const adminTablePopoverPanelClassName =
  'rounded-md border border-slate-200 bg-white p-3 text-left shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]';

export const adminTableCompactPopoverPanelClassName =
  'rounded-md border border-slate-200 bg-white p-2 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]';

export const adminTablePopoverPrimaryButtonClassName =
  `rounded-md bg-[color:var(--blue-500)] py-2 text-white ${adminTextButtonTypographyTokenClasses}`;

export const adminTablePopoverSecondaryButtonClassName =
  `rounded-md border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)] ${adminTextButtonTypographyTokenClasses}`;

export const adminTablePopoverPresetButtonClassName =
  `rounded-md border border-slate-300 px-2 py-1 text-slate-800 hover:bg-[color:var(--hover-neutral)] ${adminTextButtonTypographyTokenClasses}`;
