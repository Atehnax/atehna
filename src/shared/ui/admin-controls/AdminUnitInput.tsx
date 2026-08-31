'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode
} from 'react';
import { adminNumberInputClassName } from './adminCompactFieldStyles';
import { adminPlaceholderTokenClasses } from '@/shared/ui/theme/tokens';

export type AdminUnitInputSegmentSelect = {
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>;
  onChange: (value: string) => void;
};

export type AdminUnitInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className'
> & {
  unit?: ReactNode;
  className?: string;
  inputClassName?: string;
  unitClassName?: string;
  prefixSelect?: AdminUnitInputSegmentSelect;
  suffixSelect?: AdminUnitInputSegmentSelect;
};

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

const segmentSelectClassName =
  "h-full w-full cursor-pointer appearance-none border-0 bg-transparent px-1 py-0 text-center font-['Inter',system-ui,sans-serif] text-[10px] font-medium text-slate-600 outline-none focus:ring-0 disabled:cursor-not-allowed";

/**
 * Compact admin input with optional selectable prefix or suffix rendered
 * inside the same segmented field frame used by article controls.
 */
export const AdminUnitInput = forwardRef<HTMLInputElement, AdminUnitInputProps>(
  function AdminUnitInput(
    {
      unit,
      className,
      inputClassName,
      unitClassName,
      prefixSelect,
      suffixSelect,
      disabled,
      type = 'text',
      ...props
    },
    ref
  ) {
    return (
      <span
        className={classNames(
          'flex h-[30px] w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white transition-colors focus-within:border-[color:var(--blue-500)]',
          disabled && 'bg-[color:var(--field-locked-bg)] text-slate-500',
          className
        )}
      >
        {prefixSelect ? (
          <span className="inline-flex h-full w-[30px] shrink-0 items-center border-r border-slate-200 bg-slate-50">
            <select
              aria-label={prefixSelect.ariaLabel}
              value={prefixSelect.value}
              disabled={disabled}
              className={segmentSelectClassName}
              onChange={(event) => prefixSelect.onChange(event.target.value)}
            >
              {prefixSelect.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        ) : null}
        <input
          {...props}
          ref={ref}
          type={type}
          disabled={disabled}
          className={classNames(
            "h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[30px] text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-500",
            type === 'number' && adminNumberInputClassName,
            adminPlaceholderTokenClasses,
            inputClassName
          )}
        />
        {suffixSelect ? (
          <span
            className={classNames(
              'inline-flex h-full w-[30px] shrink-0 items-center border-l border-slate-200 bg-slate-50',
              unitClassName
            )}
          >
            <select
              aria-label={suffixSelect.ariaLabel}
              value={suffixSelect.value}
              disabled={disabled}
              className={segmentSelectClassName}
              onChange={(event) => suffixSelect.onChange(event.target.value)}
            >
              {suffixSelect.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        ) : unit !== undefined ? (
          <span
            aria-hidden="true"
            className={classNames(
              'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500',
              unitClassName
            )}
          >
            {unit}
          </span>
        ) : null}
      </span>
    );
  }
);
