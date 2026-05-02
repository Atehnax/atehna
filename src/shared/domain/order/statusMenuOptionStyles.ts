const statusInfoMenuOptionBaseClassName =
  '!bg-white !text-slate-700 disabled:!bg-white disabled:!text-slate-300';

const statusInfoMenuOptionToneClasses = {
  neutral:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-[color:var(--ui-neutral-bg)] hover:!text-slate-700 focus-visible:!bg-[color:var(--ui-neutral-bg)] focus-visible:!text-slate-700 active:!bg-[color:var(--ui-neutral-bg-hover)] active:!text-slate-700`,
  success:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-emerald-50 hover:!text-emerald-700 focus-visible:!bg-emerald-50 focus-visible:!text-emerald-700 active:!bg-emerald-100 active:!text-emerald-800`,
  warning:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-yellow-50 hover:!text-yellow-800 focus-visible:!bg-yellow-50 focus-visible:!text-yellow-800 active:!bg-yellow-100 active:!text-yellow-900`,
  sky:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-sky-50 hover:!text-sky-700 focus-visible:!bg-sky-50 focus-visible:!text-sky-700 active:!bg-sky-100 active:!text-sky-800`,
  info:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-blue-50 hover:!text-blue-700 focus-visible:!bg-blue-50 focus-visible:!text-blue-700 active:!bg-blue-100 active:!text-blue-800`,
  danger:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-orange-100 hover:!text-orange-900 focus-visible:!bg-orange-100 focus-visible:!text-orange-900 active:!bg-orange-200 active:!text-orange-950`,
  purple:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-violet-50 hover:!text-violet-700 focus-visible:!bg-violet-50 focus-visible:!text-violet-700 active:!bg-violet-100 active:!text-violet-800`,
  rose:
    `${statusInfoMenuOptionBaseClassName} hover:!bg-rose-50 hover:!text-rose-700 focus-visible:!bg-rose-50 focus-visible:!text-rose-700 active:!bg-rose-100 active:!text-rose-800`
} as const;

export type StatusInfoMenuOptionTone = keyof typeof statusInfoMenuOptionToneClasses;

export const getStatusInfoMenuOptionClassName = (
  tone: StatusInfoMenuOptionTone,
  className = ''
) =>
  `justify-between !font-semibold ${statusInfoMenuOptionToneClasses[tone]} ${className}`.trim();
