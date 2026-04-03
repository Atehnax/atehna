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

export const hoverTokenClasses = {
  neutral: 'hover:bg-[color:var(--hover-neutral)]'
} as const;

export const adminTableRowToneClasses = {
  even: 'bg-white',
  odd: 'bg-[#eef1f8]', // 'bg-[#edf1f5]',
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
  "inline-flex items-center justify-center font-['SF_Pro_Display','Helvetica_Neue','Neue_Haas_Grotesk','Inter',system-ui,sans-serif] font-normal tracking-[0] transition disabled:pointer-events-none disabled:opacity-45";
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
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-sm font-semibold leading-none text-rose-600 hover:bg-rose-50 disabled:text-slate-300',
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
    'border border-emerald-700/35 bg-emerald-50 text-emerald-700 shadow-none transition hover:bg-emerald-100 active:bg-emerald-100 disabled:cursor-default disabled:pointer-events-none disabled:opacity-60 disabled:bg-emerald-50/60 disabled:text-emerald-500',
  warning: 'border border-amber-300 text-amber-700 hover:bg-amber-100',
  danger: 'border border-rose-300 text-xs font-semibold leading-none text-rose-600 hover:bg-rose-50'
} as const;

export const pillTokenClasses = {
  list: 'inline-flex items-center rounded-xl border border-slate-300 bg-transparent',
  itemBase:
    'rounded-lg font-semibold transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  itemActive: 'rounded-lg bg-[#e9efff] text-[#3659d6]',
  itemIdle: `border border-transparent bg-transparent text-slate-700 ${hoverTokenClasses.neutral}`
} as const;

export const selectTokenClasses = {
  trigger:
    "inline-flex h-7 w-full items-center overflow-visible rounded-md border border-slate-300 bg-white px-2 py-0.5 text-left text-[11px] font-semibold leading-[1.2] text-slate-700 font-['Inter',system-ui,sans-serif] outline-none ring-0 transition hover:bg-[color:var(--hover-neutral)] focus:border-slate-300 focus:outline-none focus:ring-0 focus-visible:border-slate-300 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default disabled:text-slate-300",
  menu: 'w-full rounded-md border border-slate-300 bg-white p-1 shadow-sm',
  menuItem:
    `flex h-7 w-full items-center rounded-md px-2 text-left text-[11px] font-semibold leading-[1.2] text-slate-700 font-['Inter',system-ui,sans-serif] transition ${hoverTokenClasses.neutral} hover:text-[color:var(--blue-500)] disabled:cursor-default disabled:text-slate-300`
} as const;

export const dateInputTokenClasses = {
  base:
    'w-full border border-slate-300 bg-white text-xs text-slate-900 outline-none transition hover:bg-transparent focus:border-[#3e67d6] focus:bg-white focus:ring-0 focus-visible:border-[#3e67d6]',
  compact: 'h-8 rounded-lg px-2.5',
  floating: 'h-10 rounded-xl px-2.5 pb-1.5 pt-5 leading-6'
} as const;
