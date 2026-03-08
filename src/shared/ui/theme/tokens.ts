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
    hoverGrey: 'hover:bg-slate-100',
    hoverGreySoft: 'hover:bg-slate-50',
    focusBorder: 'focus:border-[#3e67d6] focus-visible:border-[#3e67d6]',
    focusRingNone: 'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
  },
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full'
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

export const buttonTokenClasses = {
  base:
    'inline-flex items-center justify-center font-semibold transition disabled:cursor-default disabled:opacity-60',
  primary:
    'rounded-md border border-slate-200 bg-white text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-100 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  control:
    'inline-flex h-8 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-45',
  outline:
    'rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-100 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  ghost:
    'rounded-md border border-transparent bg-transparent text-xs text-slate-700 hover:bg-slate-100 focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  adminSoft:
    'inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#ede8ff] bg-[#f8f7fc] px-3 text-xs font-semibold text-[#5d3ed6] shadow-sm transition hover:border-slate-300 hover:bg-slate-100 focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400',
  danger:
    'h-8 rounded-xl border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45',
  restore:
    'h-8 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-45',
  archive:
    'h-8 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-45',
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
    'border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-400',
  warning: 'border border-amber-300 text-amber-700 hover:bg-amber-100',
  danger: 'border border-rose-300 text-xs font-semibold leading-none text-rose-600 hover:bg-rose-50'
} as const;

export const pillTokenClasses = {
  list: 'inline-flex items-center border border-slate-300 bg-transparent',
  itemBase:
    'font-semibold transition focus-visible:border focus-visible:border-[#3e67d6] focus-visible:outline-none focus-visible:ring-0',
  itemActive: 'bg-[#e9efff] text-[#3659d6]',
  itemIdle: 'border border-transparent bg-transparent text-slate-700 hover:bg-slate-100'
} as const;

export const selectTokenClasses = {
  trigger:
    'inline-flex h-10 w-full items-center overflow-visible rounded-xl border border-slate-300 bg-white px-2.5 text-left text-xs text-slate-900 outline-none ring-0 transition hover:border-slate-300 hover:bg-transparent focus:border-[#3e67d6] focus:outline-none focus:ring-0 focus-visible:border-[#3e67d6] focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-60',
  menu: 'w-full border border-slate-200 bg-white shadow-sm',
  menuItem:
    'flex h-8 w-full items-center rounded-lg px-3 text-left text-xs font-semibold leading-none text-slate-700 transition hover:bg-slate-50 hover:text-brand-600 disabled:cursor-default disabled:text-slate-300'
} as const;

export const dateInputTokenClasses = {
  base:
    'w-full border border-slate-300 bg-white text-xs text-slate-900 outline-none transition hover:bg-transparent focus:border-[#3e67d6] focus:bg-white focus:ring-0 focus-visible:border-[#3e67d6]',
  compact: 'h-8 rounded-lg px-2.5',
  floating: 'h-10 rounded-xl px-2.5 pb-1.5 pt-5 leading-6'
} as const;
