import { useId, type ReactNode } from 'react';
import AdminFilterInput from '@/shared/ui/admin-filter-input';
import { adminRangeFilterTokenClasses } from '@/shared/ui/theme/tokens';

type RangeValue = { min: string; max: string };

type RangePreset = {
  label: string;
  value: RangeValue;
};

type AdminRangeFilterPanelProps = {
  title: string;
  titleAccessory?: ReactNode;
  draftRange: RangeValue;
  onDraftChange: (next: RangeValue) => void;
  onConfirm: () => void;
  onReset: () => void;
  presets?: RangePreset[];
  minPlaceholder?: string;
  maxPlaceholder?: string;
  min?: number;
  max?: number;
  decimalInput?: boolean;
  error?: string | null;
};

export default function AdminRangeFilterPanel({
  title,
  titleAccessory,
  draftRange,
  onDraftChange,
  onConfirm,
  onReset,
  presets,
  minPlaceholder = 'Od',
  maxPlaceholder = 'Do',
  min,
  max,
  decimalInput = false,
  error
}: AdminRangeFilterPanelProps) {
  const errorId = useId();
  return (
    <div className={adminRangeFilterTokenClasses.panel}>
      {titleAccessory ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className={`${adminRangeFilterTokenClasses.title} !mb-0`}>{title}</h4>
          {titleAccessory}
        </div>
      ) : <h4 className={adminRangeFilterTokenClasses.title}>{title}</h4>}
      {presets && presets.length > 0 ? (
        <div className={adminRangeFilterTokenClasses.presetsGrid}>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onDraftChange(preset.value)}
              className={adminRangeFilterTokenClasses.presetButton}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={adminRangeFilterTokenClasses.inputsSection}>
        <div className={adminRangeFilterTokenClasses.inputGrid}>
          <AdminFilterInput
            type={decimalInput ? 'text' : 'number'}
            inputMode={decimalInput ? 'decimal' : undefined}
            className="min-w-0 w-full"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            min={min}
            max={max}
            placeholder={minPlaceholder}
            value={draftRange.min}
            onChange={(event) => onDraftChange({ ...draftRange, min: event.target.value })}
            aria-label={minPlaceholder}
          />
          <AdminFilterInput
            type={decimalInput ? 'text' : 'number'}
            inputMode={decimalInput ? 'decimal' : undefined}
            className="min-w-0 w-full"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            min={min}
            max={max}
            placeholder={maxPlaceholder}
            value={draftRange.max}
            onChange={(event) => onDraftChange({ ...draftRange, max: event.target.value })}
            aria-label={maxPlaceholder}
          />
        </div>
      </div>
      {error ? <p id={errorId} role="alert" className="mb-3 text-[11px] text-rose-700">{error}</p> : null}
      <div className={adminRangeFilterTokenClasses.actionsGrid}>
        <button type="button" className={`${adminRangeFilterTokenClasses.confirmButton} disabled:opacity-50`} disabled={!!error} onClick={onConfirm}>
          Potrdi
        </button>
        <button type="button" className={adminRangeFilterTokenClasses.resetButton} onClick={onReset}>
          Ponastavi
        </button>
      </div>
    </div>
  );
}

export type { RangeValue, RangePreset };
