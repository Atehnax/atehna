import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';

import './floating-field.css';

export type FloatingFieldTone = 'order' | 'admin';

type BaseProps = {
  id: string;
  label: string;
  className?: string;
  tone?: FloatingFieldTone;
};

type FieldBackground = 'default' | 'muted';

type FloatingInputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder'>;
type FloatingTextareaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'placeholder'>;
type FloatingSelectProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
    children: ReactNode;
  };

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

const fieldsetBaseClasses =
  'pointer-events-none absolute inset-0 m-0 border transition-colors group-focus-within:border-brand-500 group-focus-within:ring-2 group-focus-within:ring-brand-100';

const adminFieldsetBaseClasses =
  'pointer-events-none absolute inset-0 m-0 border transition-colors group-focus-within:border-[#5d3ed6] group-focus-within:ring-0';

const toneClasses = {
  order: {
    input:
      'relative z-10 h-14 w-full rounded-lg border border-transparent bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    textarea:
      'relative z-10 min-h-[110px] w-full rounded-lg border border-transparent bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    select:
      'peer relative z-10 h-14 w-full appearance-none rounded-lg border border-transparent bg-transparent px-3 pb-2 pt-6 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400',
    fieldset: 'rounded-lg',
    legend:
      'mx-2 max-w-0 overflow-hidden whitespace-nowrap px-1 text-[11px] leading-none text-transparent transition-[max-width] duration-150',
    inputLabel:
      'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 transition-all duration-150 group-focus-within:top-2 group-focus-within:translate-y-0 group-focus-within:text-[11px] group-focus-within:text-slate-600 group-data-[filled=true]:top-2 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:text-[11px] group-data-[filled=true]:text-slate-600',
    textareaLabel:
      'pointer-events-none absolute left-3 top-6 -translate-y-1/2 text-sm text-slate-400 transition-all duration-150 group-focus-within:top-2 group-focus-within:translate-y-0 group-focus-within:text-[11px] group-focus-within:text-slate-600 group-data-[filled=true]:top-2 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:text-[11px] group-data-[filled=true]:text-slate-600',
    selectLabel:
      'pointer-events-none absolute left-3 z-10 px-1 leading-none text-slate-500 transition-all duration-150 top-2 text-[11px] group-data-[has-value=false]:top-1/2 group-data-[has-value=false]:-translate-y-1/2 group-data-[has-value=false]:px-0 group-data-[has-value=false]:text-sm group-data-[has-value=false]:text-slate-400 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:px-1 peer-focus:text-[11px] peer-focus:text-slate-600'
  },
  admin: {
    input:
      'relative z-10 h-10 w-full overflow-visible rounded-xl border border-transparent bg-transparent px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    textarea:
      'relative z-10 h-10 min-h-[40px] w-full resize-y overflow-hidden rounded-xl border border-transparent bg-transparent px-2.5 pb-1 pt-4 text-xs leading-4 text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400 read-only:cursor-not-allowed read-only:text-slate-500',
    select:
      'peer relative z-10 h-10 w-full appearance-none overflow-visible rounded-xl border border-transparent bg-transparent px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:text-slate-400',
    fieldset: 'rounded-xl',
    legend:
      'mx-2 max-w-0 overflow-hidden whitespace-nowrap px-1 text-[10px] leading-none text-transparent transition-[max-width] duration-150',
    inputLabel:
      'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 px-0 text-xs text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600',
    textareaLabel:
      'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 px-0 text-xs text-slate-400 transition-all duration-150 group-focus-within:top-1.5 group-focus-within:translate-y-0 group-focus-within:px-1 group-focus-within:text-[10px] group-focus-within:text-slate-600 group-data-[filled=true]:top-1.5 group-data-[filled=true]:translate-y-0 group-data-[filled=true]:px-1 group-data-[filled=true]:text-[10px] group-data-[filled=true]:text-slate-600',
    selectLabel:
      'pointer-events-none absolute left-2.5 top-1.5 z-10 px-1 text-[10px] text-slate-600'
  }
} as const;

export function FloatingInput({ label, id, className = '', tone = 'order', ...props }: FloatingInputProps) {
  const filled = isFilled(props.value ?? props.defaultValue);
  const classes = toneClasses[tone];
  const fieldBackground = getFieldBackground(props.disabled, props.readOnly);
  const fieldBackgroundVariable =
    ({ '--field-bg': fieldBackground === 'muted' ? 'rgb(248 250 252)' : 'rgb(255 255 255)' } as CSSProperties);
  const fieldsetBase = tone === 'admin' ? adminFieldsetBaseClasses : fieldsetBaseClasses;

  return (
    <div
      className="group relative"
      data-floating-field
      data-filled={filled ? 'true' : 'false'}
      style={fieldBackgroundVariable}
    >
      <fieldset className={classNames(fieldsetBase, classes.fieldset, 'border-slate-300 bg-[var(--field-bg)]')} aria-hidden>
        <legend className={classNames(classes.legend, 'group-focus-within:max-w-[240px] group-data-[filled=true]:max-w-[240px]')}>
          {label}
        </legend>
      </fieldset>
      <input {...props} id={id} placeholder=" " className={classNames(classes.input, className)} />
      <label htmlFor={id} className={classes.inputLabel}>
        {label}
      </label>
    </div>
  );
}

export function FloatingTextarea({
  label,
  id,
  className = '',
  tone = 'order',
  ...props
}: FloatingTextareaProps) {
  const filled = isFilled(props.value ?? props.defaultValue);
  const classes = toneClasses[tone];
  const fieldBackground = getFieldBackground(props.disabled, props.readOnly);
  const fieldBackgroundVariable =
    ({ '--field-bg': fieldBackground === 'muted' ? 'rgb(248 250 252)' : 'rgb(255 255 255)' } as CSSProperties);
  const fieldsetBase = tone === 'admin' ? adminFieldsetBaseClasses : fieldsetBaseClasses;

  return (
    <div
      className="group relative"
      data-floating-field
      data-filled={filled ? 'true' : 'false'}
      style={fieldBackgroundVariable}
    >
      <fieldset className={classNames(fieldsetBase, classes.fieldset, 'border-slate-300 bg-[var(--field-bg)]')} aria-hidden>
        <legend className={classNames(classes.legend, 'group-focus-within:max-w-[240px] group-data-[filled=true]:max-w-[240px]')}>
          {label}
        </legend>
      </fieldset>
      <textarea
        {...props}
        id={id}
        placeholder=" "
        className={classNames(classes.textarea, className)}
      />
      <label htmlFor={id} className={classes.textareaLabel}>
        {label}
      </label>
    </div>
  );
}

export function FloatingSelect({
  label,
  id,
  className = '',
  children,
  value,
  defaultValue,
  tone = 'order',
  ...props
}: FloatingSelectProps) {
  const currentValue = value ?? defaultValue ?? '';
  const hasValue = String(currentValue).length > 0;
  const classes = toneClasses[tone];
  const fieldBackground = getFieldBackground(props.disabled, false);
  const fieldBackgroundVariable =
    ({ '--field-bg': fieldBackground === 'muted' ? 'rgb(248 250 252)' : 'rgb(255 255 255)' } as CSSProperties);
  const fieldsetBase = tone === 'admin' ? adminFieldsetBaseClasses : fieldsetBaseClasses;

  return (
    <div className="group relative" data-floating-field data-has-value={hasValue} style={fieldBackgroundVariable}>
      <fieldset
        className={classNames(fieldsetBase, classes.fieldset, 'border-slate-300 bg-[var(--field-bg)]')}
        aria-hidden
      >
        <legend className={classNames(classes.legend, hasValue ? 'max-w-[240px]' : 'max-w-0', 'group-focus-within:max-w-[240px]')}>
          {label}
        </legend>
      </fieldset>
      <select
        {...props}
        id={id}
        value={value}
        defaultValue={defaultValue}
        className={classNames(classes.select, className)}
      >
        {children}
      </select>

      <label htmlFor={id} className={classes.selectLabel}>
        {label}
      </label>

      {tone === 'order' ? (
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      ) : null}
    </div>
  );
}
