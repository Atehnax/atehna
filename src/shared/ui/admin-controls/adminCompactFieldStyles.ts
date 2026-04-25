'use client';

export const adminNumberInputClassName =
  '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const adminOrderLikeEditableInputClassName =
  'mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 font-[\'Inter\',system-ui,sans-serif] text-[11px] font-normal leading-[1.2] text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:outline-none focus:ring-0';

const adminCompactTableNumberInputClassName =
  `h-6 w-full rounded-md border border-slate-300 bg-white px-1.5 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[1.2] text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:outline-none focus:ring-0 ${adminNumberInputClassName}`;

export const adminCompactTableAlignedInputClassName =
  `${adminCompactTableNumberInputClassName} !rounded-md !border-slate-300 !bg-white !px-0.5 shadow-none`;

export const adminCompactTableAlignedTextInputClassName =
  `${adminOrderLikeEditableInputClassName} !h-6 !rounded-md !border-slate-300 !bg-white !px-1 !leading-6 shadow-none`;

export const adminCompactTableValueUnitShellClassName = 'inline-flex h-6 items-center gap-1 whitespace-nowrap';
export const adminCompactTableAdornmentClassName = 'text-[11px] text-slate-500';

export const adminCompactIconFieldShellClassName =
  'mt-0.5 flex h-[30px] items-center gap-2 rounded-md border border-slate-300 bg-white pl-[10px] pr-3 transition-[border-color,box-shadow] focus-within:border-[#3e67d6]';

export const adminCompactIconFieldInputClassName =
  "h-5 w-full border-0 bg-transparent p-0 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-5 text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-900 disabled:opacity-100";

export const adminCompactExpandableTextareaClassName =
  "h-8 min-h-8 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-[5px] font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-5 text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:outline-none focus:ring-0 read-only:cursor-default disabled:cursor-not-allowed disabled:text-slate-900 disabled:opacity-100";

export const adminCompactIconFieldSelectWrapperClassName =
  'relative flex h-5 min-w-0 flex-1 items-center';

export const adminCompactIconFieldSelectClassName =
  `${adminCompactIconFieldInputClassName} block appearance-none !h-5 !rounded-none !border-0 !bg-transparent !px-0 !py-0 !pr-5 !text-[11px] !font-normal !leading-5 shadow-none hover:!bg-transparent focus:!bg-transparent`;

export const adminCompactIconFieldSelectValueClassName =
  "font-['Inter',system-ui,sans-serif] !text-[11px] !font-normal !leading-5";

export const adminArticleNameInputClassName =
  'admin-item-name-input h-full w-full min-w-0 border-0 bg-transparent p-0 shadow-none outline-none transition-[color] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed';

export const adminTopBarTitleTextClassName =
  "font-['Inter',system-ui,sans-serif] text-[22px] font-semibold leading-none tracking-tight";

export const adminTopBarArticleNameInputClassName =
  `${adminArticleNameInputClassName} admin-top-bar-title-input min-w-0 ${adminTopBarTitleTextClassName}`;
