'use client';

export const numberInputClass = '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export const orderLikeEditableInputClassName =
  'mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:outline-none focus:ring-0';

export const compactTableNumberInputClassName =
  `h-6 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] leading-6 text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:outline-none focus:ring-0 ${numberInputClass}`;

export const compactTableAlignedInputClassName =
  `${compactTableNumberInputClassName} !rounded-md !border-slate-300 !bg-white !px-0.5 shadow-none`;

export const compactTableAlignedTextInputClassName =
  `${orderLikeEditableInputClassName} !h-6 !rounded-md !border-slate-300 !bg-white !px-1 !leading-6 shadow-none`;

export const compactTableValueUnitShellClassName = 'inline-flex h-6 items-center gap-1 whitespace-nowrap';
export const compactTableAdornmentClassName = 'text-[11px] text-slate-500';
export const compactSideInputWrapClassName =
  'mt-0.5 flex h-[30px] items-center gap-2 rounded-md border border-slate-300 bg-white pl-[10px] pr-3 transition-[border-color,box-shadow] focus-within:border-[#3e67d6]';

export const articleNameInputClassName =
  'admin-item-name-input h-full w-full min-w-0 border-0 bg-transparent p-0 shadow-none outline-none transition-[color] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed';

export const topBarArticleNameInputClassName =
  `${articleNameInputClassName} min-w-0 font-['Inter',system-ui,sans-serif] text-[22px] font-semibold leading-none tracking-tight`;
