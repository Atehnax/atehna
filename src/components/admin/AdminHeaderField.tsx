'use client';

import type { ChangeEventHandler, ReactNode } from 'react';

type BaseProps = {
  id: string;
  label: string;
  className?: string;
};

type InputFieldProps = BaseProps & {
  kind?: 'input';
  type?: 'text' | 'email' | 'date';
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

type SelectFieldProps = BaseProps & {
  kind: 'select';
  value: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
};

type TextareaFieldProps = BaseProps & {
  kind: 'textarea';
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
};

type AdminHeaderFieldProps = InputFieldProps | SelectFieldProps | TextareaFieldProps;

const shellClassName =
  'group relative rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-[#5d3ed6] focus-within:ring-2 focus-within:ring-brand-100';

const fieldBaseClassName =
  'h-10 w-full overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-1.5 pt-5 text-xs leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0';

export default function AdminHeaderField(props: AdminHeaderFieldProps) {
  const { id, label, className = '' } = props;

  return (
    <div className={shellClassName}>
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-2.5 top-1.5 z-10 bg-white px-1 text-[10px] text-slate-600"
      >
        {label}
      </label>

      {props.kind === 'select' ? (
        <>
          <select
            id={id}
            value={props.value}
            onChange={props.onChange}
            className={`${fieldBaseClassName} appearance-none pr-7 ${className}`}
          >
            {props.children}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
        </>
      ) : props.kind === 'textarea' ? (
        <textarea
          id={id}
          value={props.value}
          onChange={props.onChange}
          className={`${fieldBaseClassName} resize-none ${className}`}
        />
      ) : (
        <input
          id={id}
          type={props.type ?? 'text'}
          value={props.value}
          onChange={props.onChange}
          className={`${fieldBaseClassName} ${className}`}
        />
      )}
    </div>
  );
}
