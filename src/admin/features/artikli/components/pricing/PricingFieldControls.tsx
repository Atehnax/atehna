'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { formatDecimalForDisplay, parseDecimalInput } from '@/admin/features/artikli/lib/decimalFormat';
import {
  adminCompactTableAdornmentClassName as compactTableAdornmentClassName,
  adminCompactTableAlignedInputClassName as compactTableAlignedInputClassName,
  adminCompactTableValueUnitShellClassName as compactTableValueUnitShellClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';

export const sectionTitleClassName = 'text-[20px] font-semibold tracking-tight text-slate-900';
export const fieldFrameClassName = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0 disabled:cursor-not-allowed disabled:bg-[color:var(--field-locked-bg)] disabled:text-slate-500';
export const compactInfoFieldFrameClassName = `${fieldFrameClassName} !h-[30px] !px-2 !text-[12px]`;
export const smallLabelClassName = 'mb-1 block text-[12px] font-semibold text-slate-700';
export const inlineSnippetClassName = 'rounded bg-[#1982bf1a] px-1 py-0.5 font-mono text-[11px] text-[#1982bf]';
export const fieldUnitAdornmentClassName = 'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 px-2 text-[12px] font-medium text-slate-500';
export const compactSegmentedFieldShellClassName =
  'flex h-[30px] w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white transition-colors focus-within:border-[color:var(--blue-500)]';
export const compactSegmentedFieldPrefixClassName =
  'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-r border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-500';
export const compactSegmentedFieldSuffixClassName =
  'inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap border-l border-slate-200 bg-slate-50 px-1 text-[10px] font-medium text-slate-500';
export const compactTableThirtyInputClassName = `${compactTableAlignedInputClassName} !h-[30px] !min-h-[30px] !text-[11px] !leading-[30px]`;
export const compactTableThirtyValueUnitShellClassName = `${compactTableValueUnitShellClassName} !h-[30px] !min-h-[30px] !items-center`;
export const compactTableReadOnlyInputClassName =
  "inline-flex h-[30px] min-h-[30px] items-center rounded-md border border-transparent bg-transparent px-0.5 font-['Inter',system-ui,sans-serif] text-[11px] font-normal leading-[30px] text-slate-700 outline-none shadow-none";
export const simulatorControlValueClassName = "font-['Inter',system-ui,sans-serif] text-[11px] font-semibold leading-[1.2] text-slate-900 not-italic";
export const simulatorSelectTriggerClassName = "!h-[30px] !rounded-md !px-3 !font-['Inter',system-ui,sans-serif] !text-[11px] !font-semibold !leading-[1.2] !text-slate-900 !not-italic !transition-none !duration-0";
export const simulatorSelectValueClassName = "!font-['Inter',system-ui,sans-serif] !text-[11px] !font-semibold !leading-[1.2] !text-slate-900 !not-italic !transition-none !duration-0";
export const simulatorControlValueStyle: CSSProperties = {
  fontFamily: '"Inter", system-ui, sans-serif',
  fontSize: '11px',
  fontStyle: 'normal',
  fontWeight: 600,
  lineHeight: '1.2'
};

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function DisabledSelectionCheckbox({ checked = false }: { checked?: boolean }) {
  return <AdminCheckbox checked={checked} disabled onChange={() => {}} />;
}

export function ReadOnlyCompactField({
  value,
  align = 'left',
  className
}: {
  value: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  return (
    <span
      className={classNames(
        compactInfoFieldFrameClassName,
        'inline-flex items-center bg-[color:var(--field-locked-bg)] text-slate-600',
        align === 'center' && 'justify-center text-center',
        align === 'right' && 'justify-end text-right',
        className
      )}
    >
      {value === null || value === undefined || value === '' ? '—' : value}
    </span>
  );
}

export function ReadOnlyTableInput({
  value,
  className
}: {
  value: string | number;
  className?: string;
}) {
  const alignmentClassName = className?.includes('text-right')
    ? 'justify-end text-right'
    : className?.includes('text-center')
      ? 'justify-center text-center'
      : 'justify-start text-left';

  return (
    <span
      aria-readonly="true"
      className={classNames(
        compactTableReadOnlyInputClassName,
        alignmentClassName,
        className,
        '!border-transparent !bg-transparent !shadow-none'
      )}
    >
      {String(value)}
    </span>
  );
}

export function CompactSegmentedField({
  value,
  editable,
  prefix,
  suffix,
  inputMode = 'decimal',
  align = 'right',
  disabled = false,
  placeholder,
  ariaLabel,
  title,
  maxLength,
  className,
  inputClassName,
  onChange,
  onBlur
}: {
  value: string | number | null | undefined;
  editable: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputMode?: 'decimal' | 'numeric' | 'text';
  align?: 'left' | 'center' | 'right';
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}) {
  const alignmentClassName = align === 'left'
    ? 'text-left'
    : align === 'center'
      ? 'text-center'
      : 'text-right';
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);

  return (
    <span
      className={classNames(
        compactSegmentedFieldShellClassName,
        !editable && 'bg-slate-50',
        disabled && 'bg-[color:var(--field-locked-bg)] text-slate-500',
        className
      )}
      title={title}
    >
      {prefix !== undefined ? (
        <span className={compactSegmentedFieldPrefixClassName}>{prefix}</span>
      ) : null}
      {editable ? (
        <input
          type="text"
          inputMode={inputMode}
          disabled={disabled}
          maxLength={maxLength}
          className={classNames(
            "h-full min-w-0 flex-1 border-0 bg-transparent px-1 font-['Inter',system-ui,sans-serif] text-[10px] font-normal leading-[30px] text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-500",
            alignmentClassName,
            inputClassName
          )}
          value={value ?? ''}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <span
          aria-readonly="true"
          className={classNames(
            "inline-flex h-full min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap px-1 font-['Inter',system-ui,sans-serif] text-[10px] font-normal text-slate-700",
            align === 'left' && 'justify-start',
            align === 'center' && 'justify-center',
            align === 'right' && 'justify-end',
            alignmentClassName,
            inputClassName
          )}
        >
          {displayValue}
        </span>
      )}
      {suffix !== undefined ? (
        <span className={compactSegmentedFieldSuffixClassName}>{suffix}</span>
      ) : null}
    </span>
  );
}

export function DecimalDraftInput({
  value,
  className,
  style,
  disabled,
  onEmpty,
  onDecimalChange
}: {
  value: number | string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  onEmpty?: () => void;
  onDecimalChange: (value: number) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      style={style}
      disabled={disabled}
      value={typeof value === 'number' ? formatDecimalForDisplay(value) : value}
      onChange={(event) => {
        const rawValue = event.target.value;
        if (!rawValue.trim()) {
          onEmpty?.();
          return;
        }
        const parsed = parseDecimalInput(rawValue);
        if (parsed !== null) onDecimalChange(parsed);
      }}
    />
  );
}

export function NumberField({
  label,
  value,
  suffix,
  editable,
  onChange
}: {
  label: string;
  value: number;
  suffix?: string;
  editable: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className={smallLabelClassName}>{label}</span>
      {editable ? (
        <span className="flex h-9 rounded-md border border-slate-300 bg-white">
          <DecimalDraftInput
            className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] text-slate-900 outline-none focus:ring-0"
            value={value}
            onDecimalChange={onChange}
          />
          {suffix ? <span className={fieldUnitAdornmentClassName}>{suffix}</span> : null}
        </span>
      ) : (
        <ReadOnlyCompactField value={suffix ? `${formatDecimalForDisplay(value)} ${suffix}` : formatDecimalForDisplay(value)} />
      )}
    </label>
  );
}

export function TextField({
  label,
  value,
  editable,
  onChange,
  suffix
}: {
  label: string;
  value: string;
  editable: boolean;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={smallLabelClassName}>{label}</span>
      {editable ? (
        <span className="flex h-9 rounded-md border border-slate-300 bg-white">
          <input
            className="h-full min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-2.5 text-[13px] text-slate-900 outline-none focus:ring-0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {suffix ? <span className={fieldUnitAdornmentClassName}>{suffix}</span> : null}
        </span>
      ) : (
        <ReadOnlyCompactField value={suffix ? `${value} ${suffix}` : value} />
      )}
    </label>
  );
}

export function ToggleRow({
  label,
  enabled,
  editable,
  onChange
}: {
  label: string;
  enabled: boolean;
  editable: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
      <AdminCheckbox checked={enabled} disabled={!editable} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export { compactTableAdornmentClassName, compactTableAlignedInputClassName, compactTableValueUnitShellClassName };
