import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';

import './floating-field.css';

export type FloatingFieldTone = 'order' | 'admin';
export type FloatingFieldLabelMode = 'floating' | 'static';

type BaseProps = {
  id: string;
  label: string;
  className?: string;
  tone?: FloatingFieldTone;
  labelMode?: FloatingFieldLabelMode;
};

type FieldBackground = 'default' | 'muted';

type FloatingInputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder'>;
type FloatingTextareaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'placeholder'>;
const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const isFilled = (value: unknown) => {
  if (value === null || value === undefined) return false;
  return String(value).length > 0;
};

const getFieldBackground = (disabled?: boolean, readOnly?: boolean): FieldBackground => {
  if (disabled || readOnly) return 'muted';
  return 'default';
};

const toneClasses = {
  order: {
    shell:
      'group relative rounded-lg border border-slate-300 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100',
    input:
      'h-14 w-full rounded-lg border-0 bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    textarea:
      'min-h-[110px] w-full rounded-lg border-0 bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    select:
      'peer h-14 w-full appearance-none rounded-lg border-0 bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400',
    inputLabel:
      'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 transition-all duration-150 group-focus-within:top-2 group-focus-within:translate-y-0 group-focus-within:bg-[var(--field-bg)] group-focus-within:px-1 group-focus-within:text-[11px] group-focus-within:text-slate-600 group-data-[filled=true]:top-2 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-[var(--field-bg)] group-data-[filled=true]:px-1 group-data-[filled=true]:text-[11px] group-data-[filled=true]:text-slate-600',
    inputLabelStatic:
      'pointer-events-none absolute left-3 top-2 z-10 bg-[var(--field-bg)] px-1 leading-none text-[11px] text-slate-600',
    textareaLabel:
      'pointer-events-none absolute left-3 top-6 -translate-y-1/2 text-sm text-slate-400 transition-all duration-150 group-focus-within:top-2 group-focus-within:translate-y-0 group-focus-within:bg-[var(--field-bg)] group-focus-within:px-1 group-focus-within:text-[11px] group-focus-within:text-slate-600 group-data-[filled=true]:top-2 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-[var(--field-bg)] group-data-[filled=true]:px-1 group-data-[filled=true]:text-[11px] group-data-[filled=true]:text-slate-600',
    textareaLabelStatic:
      'pointer-events-none absolute left-3 top-2 z-10 bg-[var(--field-bg)] px-1 leading-none text-[11px] text-slate-600',
    selectLabel:
      'pointer-events-none absolute left-3 z-10 bg-[var(--field-bg)] px-1 leading-none text-slate-500 transition-all duration-150 top-2 text-[11px] group-data-[has-value=false]:top-1/2 group-data-[has-value=false]:-translate-y-1/2 group-data-[has-value=false]:bg-transparent group-data-[has-value=false]:px-0 group-data-[has-value=false]:text-sm group-data-[has-value=false]:text-slate-400 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:bg-[var(--field-bg)] peer-focus:px-1 peer-focus:text-[11px] peer-focus:text-slate-600',
    selectLabelStatic:
      'px-3 pt-2 text-xs leading-4 text-slate-600',
    staticShell: 'flex min-h-[56px] flex-col rounded-lg',
    staticInput: 'w-full border-0 bg-transparent px-3 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0',
    staticTextarea:
      'min-h-[110px] w-full border-0 bg-transparent px-3 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0 resize-y',
    staticSelect:
      'w-full appearance-none border-0 bg-transparent px-3 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0'
  },
  admin: {
    shell:
      'group relative rounded-xl border border-slate-300 transition-colors focus-within:border-[#5d3ed6] focus-within:ring-2 focus-within:ring-brand-100',
    input:
      'h-10 w-full overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    textarea:
      'h-10 min-h-[40px] w-full resize-y overflow-hidden rounded-xl border-0 bg-transparent px-2.5 pb-1 pt-4 text-xs leading-4 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    select:
      'peer h-10 w-full appearance-none overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:text-slate-400',
    inputLabel:
      'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 bg-transparent px-0 text-xs text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-[var(--field-bg)] group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-[var(--field-bg)] group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600',
    inputLabelStatic:
      'pointer-events-none absolute left-2.5 top-1.5 z-10 bg-[var(--field-bg)] px-1 leading-none text-[10px] text-slate-600',
    textareaLabel:
      'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 bg-transparent px-0 text-xs text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:bg-[var(--field-bg)] group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:bg-[var(--field-bg)] group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600',
    textareaLabelStatic:
      'pointer-events-none absolute left-2.5 top-1.5 z-10 bg-[var(--field-bg)] px-1 leading-none text-[10px] text-slate-600',
    selectLabel:
      'pointer-events-none absolute left-2.5 top-1.5 z-10 bg-[var(--field-bg)] px-1 text-[10px] text-slate-600 group-data-[has-value=false]:top-1/2 group-data-[has-value=false]:-translate-y-1/2 group-data-[has-value=false]:bg-transparent group-data-[has-value=false]:px-0 group-data-[has-value=false]:text-xs group-data-[has-value=false]:text-slate-400',
    selectLabelStatic:
      'px-2.5 pt-2 text-xs leading-4 text-slate-600',
    staticShell: 'flex min-h-10 flex-col rounded-xl',
    staticInput:
      'w-full border-0 bg-transparent px-2.5 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0 overflow-visible',
    staticTextarea:
      'min-h-[60px] w-full border-0 bg-transparent px-2.5 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0 resize-y',
    staticSelect:
      'w-full appearance-none border-0 bg-transparent px-2.5 pb-2 text-sm leading-5 text-slate-900 outline-none ring-0 overflow-visible'
  }
} as const;

export function FloatingInput({
  label,
  id,
  className = '',
  tone = 'order',
  labelMode = 'floating',
  ...props
}: FloatingInputProps) {
  const filled = isFilled(props.value ?? props.defaultValue);
  const classes = toneClasses[tone];
  const fieldBackground = getFieldBackground(props.disabled, props.readOnly);
  const fieldBackgroundVariable =
    ({ '--field-bg': fieldBackground === 'muted' ? 'rgb(248 250 252)' : 'rgb(255 255 255)' } as CSSProperties);

  const isStatic = labelMode === 'static';

  return (
    <div
      className={classNames(classes.shell, isStatic && classes.staticShell)}
      data-floating-field
      data-filled={filled ? 'true' : 'false'}
      style={{ ...fieldBackgroundVariable, backgroundColor: 'var(--field-bg)' }}
    >
      {isStatic ? (
        <>
          <label htmlFor={id} className={classes.inputLabelStatic}>
            {label}
          </label>
          <input {...props} id={id} className={classNames(classes.staticInput, 'mt-1', className)} />
        </>
      ) : (
        <>
          <input {...props} id={id} placeholder=" " className={classNames(classes.input, className)} />
          <label htmlFor={id} className={classes.inputLabel}>
            {label}
          </label>
        </>
      )}
    </div>
  );
}

export function FloatingTextarea({
  label,
  id,
  className = '',
  tone = 'order',
  labelMode = 'floating',
  ...props
}: FloatingTextareaProps) {
  const filled = isFilled(props.value ?? props.defaultValue);
  const classes = toneClasses[tone];
  const fieldBackground = getFieldBackground(props.disabled, props.readOnly);
  const fieldBackgroundVariable =
    ({ '--field-bg': fieldBackground === 'muted' ? 'rgb(248 250 252)' : 'rgb(255 255 255)' } as CSSProperties);

  const isStatic = labelMode === 'static';

  return (
    <div
      className={classNames(classes.shell, isStatic && classes.staticShell)}
      data-floating-field
      data-filled={filled ? 'true' : 'false'}
      style={{ ...fieldBackgroundVariable, backgroundColor: 'var(--field-bg)' }}
    >
      {isStatic ? (
        <>
          <label htmlFor={id} className={classes.textareaLabelStatic}>
            {label}
          </label>
          <textarea {...props} id={id} className={classNames(classes.staticTextarea, 'mt-1', className)} />
        </>
      ) : (
        <>
          <textarea {...props} id={id} placeholder=" " className={classNames(classes.textarea, className)} />
          <label htmlFor={id} className={classes.textareaLabel}>
            {label}
          </label>
        </>
      )}
    </div>
  );
}

