'use client';

import type { ChangeEventHandler, ReactNode } from 'react';
import { EuiFieldText, EuiTextArea } from '@elastic/eui';
import { dateInputTokenClasses } from '@/shared/ui/theme/tokens';

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
  'group relative rounded-xl border border-slate-300 bg-white transition-colors focus-within:border-[#3e67d6] focus-within:ring-2 focus-within:ring-brand-100';

const fieldBaseClassName =
  'h-10 w-full overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-1.5 pt-5 font-[\'Inter\',system-ui,sans-serif] text-[11px] leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0';

const textareaFieldClassName =
  'min-h-10 w-full resize-y overflow-y-auto rounded-xl border-0 bg-transparent px-2.5 py-2 font-[\'Inter\',system-ui,sans-serif] text-[11px] leading-5 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0';

const selectFieldClassName =
  'h-10 w-full appearance-none overflow-visible rounded-xl border-0 bg-transparent px-2.5 pb-0 pt-4 text-xs leading-6 text-slate-900 outline-none ring-0 transition focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0';

export default function AdminHeaderField(props: AdminHeaderFieldProps) {
  const { id, label, className = '' } = props;

  return (
    <div className={shellClassName}>
      {props.kind === 'select' ? (
        <>
          <select
            id={id}
            value={props.value}
            onChange={props.onChange}
            className={`${selectFieldClassName} pr-7 ${className}`}
          >
            {props.children}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
        </>
      ) : props.kind === 'textarea' ? (
        <EuiTextArea
          id={id}
          value={props.value}
          onChange={props.onChange}
          rows={1}
          fullWidth
          placeholder={label}
          aria-label={label}
          className={`${textareaFieldClassName} ${className}`}
        />
      ) : (
        <EuiFieldText
          id={id}
          type={props.type ?? 'text'}
          value={props.value}
          onChange={props.onChange}
          fullWidth
          placeholder={label}
          aria-label={label}
          className={`${props.type === 'date' ? `${dateInputTokenClasses.base} ${dateInputTokenClasses.floating}` : fieldBaseClassName} ${className}`}
        />
      )}
    </div>
  );
}
