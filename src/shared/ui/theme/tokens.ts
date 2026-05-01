export const UI_TOKENS = {
  colors: {
    surface: 'bg-white',
    border: 'border-slate-200',
    borderHover: 'hover:border-slate-300',
    text: 'text-slate-700',
    textMuted: 'text-slate-600',
    accentText: 'text-[#5d3ed6]',
    accentBorder: 'border-[#5d3ed6]',
    accentBgSoft: 'bg-[#f8f7fc]',
    focusBorder: 'focus:border-[#3e67d6] focus-visible:border-[#3e67d6]',
    focusRingNone: 'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-xl'
  },
  shadows: {
    sm: 'shadow-sm',
    none: 'shadow-none'
  },
  spacing: {
    controlX: 'px-3',
    controlXSm: 'px-2',
    controlY: 'py-1',
    controlYSm: 'py-0.5'
  },
  heights: {
    sm: 'h-7',
    md: 'h-8'
  }
} as const;

export const adminTextButtonTypographyTokenClasses =
  "font-['Inter',system-ui,sans-serif] !text-xs !font-normal";

export const adminPlaceholderTokenClasses =
  'placeholder:font-normal placeholder:text-slate-300 placeholder:opacity-100';

export const adminSearchPlaceholderTokenClasses =
  'placeholder:font-normal placeholder:text-slate-500 placeholder:opacity-80';

export const adminStatusInfoPillClassName =
  'h-[26px] min-w-[132px] justify-center px-4 text-[11px]';

export const adminStatusInfoPillGapClassName = 'gap-4';
export const adminStatusInfoPillGroupClassName =
  `flex flex-wrap items-center ${adminStatusInfoPillGapClassName}`;
export const adminStatusInfoPillTableColumnWidth = '148px';
export const adminStatusInfoPillTableColumnClassName =
  'w-[148px] min-w-[148px] max-w-[148px]';
export const adminStatusInfoPillTableCellClassName =
  `${adminStatusInfoPillTableColumnClassName} !px-0 text-center`;
export const adminStatusInfoPillCompactTableClassName =
  '!h-[23.4px] !min-w-[94px] !px-1.5 !text-[10px]';
export const adminStatusInfoPillVariantTableClassName =
  '!h-[26px] !min-h-[26px] !min-w-[94px] !px-1.5 !text-[11px]';

export const adminStatusInfoMenuOptionBaseClassName =
  '!bg-white !text-slate-700 disabled:!bg-white disabled:!text-slate-300';

export const adminStatusInfoMenuOptionToneClasses = {
  neutral:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-[color:var(--ui-neutral-bg)] hover:!text-slate-700 focus-visible:!bg-[color:var(--ui-neutral-bg)] focus-visible:!text-slate-700 active:!bg-[color:var(--ui-neutral-bg-hover)] active:!text-slate-700`,
  success:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-emerald-50 hover:!text-emerald-700 focus-visible:!bg-emerald-50 focus-visible:!text-emerald-700 active:!bg-emerald-100 active:!text-emerald-800`,
  warning:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-yellow-50 hover:!text-yellow-800 focus-visible:!bg-yellow-50 focus-visible:!text-yellow-800 active:!bg-yellow-100 active:!text-yellow-900`,
  sky:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-sky-50 hover:!text-sky-700 focus-visible:!bg-sky-50 focus-visible:!text-sky-700 active:!bg-sky-100 active:!text-sky-800`,
  info:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-blue-50 hover:!text-blue-700 focus-visible:!bg-blue-50 focus-visible:!text-blue-700 active:!bg-blue-100 active:!text-blue-800`,
  danger:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-orange-100 hover:!text-orange-900 focus-visible:!bg-orange-100 focus-visible:!text-orange-900 active:!bg-orange-200 active:!text-orange-950`,
  purple:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-violet-50 hover:!text-violet-700 focus-visible:!bg-violet-50 focus-visible:!text-violet-700 active:!bg-violet-100 active:!text-violet-800`,
  rose:
    `${adminStatusInfoMenuOptionBaseClassName} hover:!bg-rose-50 hover:!text-rose-700 focus-visible:!bg-rose-50 focus-visible:!text-rose-700 active:!bg-rose-100 active:!text-rose-800`
} as const;

export type AdminStatusInfoMenuOptionTone = keyof typeof adminStatusInfoMenuOptionToneClasses;

export const getAdminStatusInfoMenuOptionClassName = (
  tone: AdminStatusInfoMenuOptionTone,
  className = ''
) =>
  `justify-between !font-semibold ${adminStatusInfoMenuOptionToneClasses[tone]} ${className}`.trim();

export const hoverTokenClasses = {
  neutral: 'hover:bg-[color:var(--hover-neutral)]'
} as const;

export const adminTableRowToneClasses = {
  even: 'bg-white',
  odd: 'bg-[#eef1f8]',
  hover: 'hover:bg-[color:var(--admin-table-row-hover)]',
  selected: 'bg-[color:var(--admin-table-row-selected)]'
} as const;

export const adminCategoryRowToneByLevel: Record<number, string> = {
  0: 'bg-[#eef1f8]',
  1: 'bg-[#eef1f8]',
  2: 'bg-[#ffffff]',
  3: 'bg-[#f5f7fa]',
  4: 'bg-[#f9fbfc]'
};

export const getAdminStripedRowToneClass = (rowIndex: number) =>
  rowIndex % 2 === 0 ? adminTableRowToneClasses.even : adminTableRowToneClasses.odd;

export const getAdminCategoryRowToneClass = (level: number) =>
  adminCategoryRowToneByLevel[level] ?? 'bg-[#fcfdfe]';

export const surfaceTokenClasses = {
  neutral: 'bg-[color:var(--hover-neutral)]',
  disabled: 'bg-[color:var(--hover-neutral)]'
} as const;

const BTN_BASE =
  "inline-flex items-center justify-center font-['Inter',system-ui,sans-serif] font-normal tracking-[0] transition disabled:pointer-events-none disabled:opacity-45";
const BTN_FOCUS =
  'focus:border-[color:var(--blue-500)] focus:outline-none focus:ring-0 focus-visible:border-[color:var(--blue-500)] focus-visible:outline-none focus-visible:ring-0';
const BTN_SIZE_MD = 'h-8 px-3 rounded-lg text-xs';
const BTN_SIZE_PILL = 'h-9 px-4 rounded-md text-[13px] leading-none';

export const semanticButtonColors = {
  neutral: {
    border: 'border-slate-300',
    bg: 'bg-white',
    text: 'text-slate-700',
    hoverBorder: 'hover:border-slate-300',
    hoverBg: 'hover:bg-[color:var(--hover-neutral)]',
    activeBg: 'active:bg-[color:var(--hover-neutral)]'
  },
  primary: {
    border: 'border-transparent',
    bg: 'bg-[color:var(--blue-500)]',
    text: 'text-white',
    hoverBg: 'hover:bg-[color:var(--blue-600)]',
    activeBg: 'active:bg-[color:var(--blue-700)]'
  },
  warning: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    hoverBg: 'hover:bg-amber-100',
    activeBg: 'active:bg-amber-100'
  },
  danger: {
    border: 'border-rose-300',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    hoverBg: 'hover:bg-rose-100',
    activeBg: 'active:bg-rose-100'
  },
  success: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    hoverBg: 'hover:bg-emerald-100',
    activeBg: 'active:bg-emerald-100'
  }
} as const;

export const buttonTokenClasses = {
  base: BTN_BASE,
  primary: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_PILL} border ${semanticButtonColors.primary.border} ${semanticButtonColors.primary.bg} ${semanticButtonColors.primary.text} ${semanticButtonColors.primary.hoverBg} ${semanticButtonColors.primary.activeBg} disabled:bg-slate-200 disabled:text-slate-400`,
  control: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_MD} border ${semanticButtonColors.neutral.border} ${semanticButtonColors.neutral.bg} ${semanticButtonColors.neutral.text} ${semanticButtonColors.neutral.hoverBorder} ${semanticButtonColors.neutral.hoverBg} ${semanticButtonColors.neutral.activeBg}`,
  outline: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_PILL} border ${semanticButtonColors.neutral.border} ${semanticButtonColors.neutral.bg} ${semanticButtonColors.neutral.text} ${semanticButtonColors.neutral.hoverBorder} ${semanticButtonColors.neutral.hoverBg} ${semanticButtonColors.neutral.activeBg}`,
  ghost: `${BTN_BASE} ${BTN_FOCUS} rounded-md border border-transparent bg-transparent text-xs text-slate-700 ${semanticButtonColors.neutral.hoverBg} ${semanticButtonColors.neutral.activeBg}`,
  adminSoft:
    `inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#ede8ff] bg-[#f8f7fc] px-3 text-xs font-semibold text-[#5d3ed6] shadow-sm transition hover:border-slate-300 ${hoverTokenClasses.neutral} active:bg-[color:var(--hover-neutral)] focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400`,
  danger: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_MD} border ${semanticButtonColors.danger.border} ${semanticButtonColors.danger.bg} ${semanticButtonColors.danger.text} ${semanticButtonColors.danger.hoverBg} ${semanticButtonColors.danger.activeBg}`,
  restore: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_MD} border ${semanticButtonColors.success.border} ${semanticButtonColors.success.bg} ${semanticButtonColors.success.text} ${semanticButtonColors.success.hoverBg} ${semanticButtonColors.success.activeBg}`,
  archive: `${BTN_BASE} ${BTN_FOCUS} ${BTN_SIZE_MD} border ${semanticButtonColors.warning.border} ${semanticButtonColors.warning.bg} ${semanticButtonColors.warning.text} ${semanticButtonColors.warning.hoverBg} ${semanticButtonColors.warning.activeBg}`,
  closeX:
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-sm font-semibold leading-none text-rose-600 transition hover:bg-rose-50 active:bg-rose-50 disabled:bg-white disabled:text-slate-300',
  activeSuccess: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  inactiveNeutral: 'border border-slate-200 bg-slate-100 text-slate-600',
  activeSuccessBorderless: 'border border-transparent bg-emerald-50 text-emerald-700',
  inactiveNeutralBorderless: 'border border-transparent bg-slate-100 text-slate-600'
} as const;

export const iconButtonTokenClasses = {
  base: 'inline-flex items-center justify-center',
  neutral:
    'border border-slate-200 bg-transparent text-slate-600 shadow-none transition hover:border-slate-300 hover:bg-[color:var(--hover-neutral)] active:bg-[color:var(--hover-neutral)] hover:text-[color:var(--blue-500)] active:text-[color:var(--blue-500)] disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-transparent disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400',
  neutralStatus:
    'border border-slate-300 bg-[color:var(--ui-neutral-bg)] text-slate-700 shadow-none transition hover:border-slate-300 hover:bg-[color:var(--ui-neutral-bg-hover)] active:bg-[color:var(--ui-neutral-bg-hover)] hover:text-[color:var(--blue-500)] active:text-[color:var(--blue-500)] disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-transparent disabled:text-slate-400',
  success:
    'border border-emerald-700/35 bg-white text-emerald-700 shadow-none transition hover:bg-emerald-50 active:bg-emerald-100 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-white disabled:text-slate-300',
  warning: 'border border-amber-300 bg-white text-amber-700 shadow-none transition hover:bg-amber-50 active:bg-amber-100 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-white disabled:text-slate-300',

  add:
    'border border-amber-300/80 bg-amber-50/80 text-amber-700 shadow-none transition hover:border-dashed hover:border-amber-400 hover:bg-amber-100/80 active:bg-amber-100/80 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60',
  danger: 'border border-rose-300 bg-white text-xs font-semibold leading-none text-rose-600 shadow-none transition hover:bg-rose-50 active:bg-rose-100 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-white disabled:text-slate-300'
} as const;

export const pillTokenClasses = {
  list: 'inline-flex items-center rounded-xl border border-slate-300 bg-transparent',
  itemBase:
    'rounded-lg font-semibold transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  itemActive: 'rounded-lg bg-[#e9efff] text-[#3659d6]',
  itemIdle: `border border-transparent bg-transparent text-slate-700 ${hoverTokenClasses.neutral}`
} as const;

export const filterPillTokenClasses = {
  base: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-[color:var(--ui-neutral-bg)] px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-[color:var(--ui-neutral-bg-hover)]',
  clear: 'inline-flex text-[12px] leading-none text-slate-500 transition hover:text-[color:var(--danger-600)] active:text-[color:var(--danger-600)]'
} as const;

export const adminFilterInputTokenClasses =
  `h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[12px] leading-[1.25] text-slate-700 font-['Inter',system-ui,sans-serif] outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 ${adminPlaceholderTokenClasses}`;

export const adminRangeFilterTokenClasses = {
  panel: 'rounded-md border border-slate-200 bg-white p-2 text-left shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]',
  title: 'mb-2 text-[11px] font-semibold text-slate-800',
  presetsGrid: 'mb-3 grid grid-cols-3 gap-1',
  presetButton:
    `rounded-md border border-slate-300 px-2 py-1 text-slate-800 hover:bg-[color:var(--hover-neutral)] ${adminTextButtonTypographyTokenClasses}`,
  inputsSection: 'mb-3 border-t border-slate-200 pt-3',
  inputGrid: 'grid grid-cols-2 gap-2',
  actionsGrid: 'grid grid-cols-2 gap-2',
  confirmButton: `rounded-md bg-[color:var(--blue-500)] py-2 text-white ${adminTextButtonTypographyTokenClasses}`,
  resetButton:
    `rounded-md border border-slate-300 bg-[color:var(--ui-neutral-bg)] py-2 text-slate-700 hover:bg-[color:var(--ui-neutral-bg-hover)] ${adminTextButtonTypographyTokenClasses}`
} as const;

export const selectTokenClasses = {
  trigger:
    "inline-flex h-7 w-full items-center overflow-visible rounded-md border border-slate-300 bg-white px-2 py-0.5 text-left text-[11px] font-normal leading-[1.2] text-slate-700 font-['Inter',system-ui,sans-serif] outline-none ring-0 transition hover:bg-white active:bg-white focus:border-[#3e67d6] focus:bg-white focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:bg-white focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default disabled:text-slate-300",
  menu: 'w-full rounded-md border border-slate-200 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.05)]',
  menuItem:
    `flex h-8 w-full items-center rounded-md px-2.5 text-left text-[12px] font-normal leading-[1.25] text-slate-700 font-['Inter',system-ui,sans-serif] transition ${hoverTokenClasses.neutral} hover:text-[color:var(--blue-500)] disabled:cursor-default disabled:text-slate-300`
} as const;

export const dateInputTokenClasses = {
  base:
    'w-full border border-slate-300 bg-white text-xs text-slate-900 outline-none transition hover:bg-transparent focus:border-[#3e67d6] focus:bg-white focus:ring-0 focus-visible:border-[#3e67d6]',
  compact: 'h-8 rounded-lg px-2.5',
  floating: 'h-10 rounded-xl px-2.5 pb-1.5 pt-5 leading-6'
} as const;

export const adminInputFocusTokenClasses =
  'outline-none focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none';
