import AdminFilterInput from '@/shared/ui/admin-filter-input';
import { adminRangeFilterTokenClasses } from '@/shared/ui/theme/tokens';

type RangeValue = { min: string; max: string };

type RangePreset = {
  label: string;
  value: RangeValue;
};

type AdminRangeFilterPanelProps = {
  title: string;
  draftRange: RangeValue;
  onDraftChange: (next: RangeValue) => void;
  onConfirm: () => void;
  onReset: () => void;
  presets?: RangePreset[];
  minPlaceholder?: string;
  maxPlaceholder?: string;
  min?: number;
  max?: number;
};

export default function AdminRangeFilterPanel({
  title,
  draftRange,
  onDraftChange,
  onConfirm,
  onReset,
  presets,
  minPlaceholder = 'Od',
  maxPlaceholder = 'Do',
  min,
  max
}: AdminRangeFilterPanelProps) {
  return (
    <div className={adminRangeFilterTokenClasses.panel}>
      <h4 className={adminRangeFilterTokenClasses.title}>{title}</h4>
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
            type="number"
            min={min}
            max={max}
            placeholder={minPlaceholder}
            value={draftRange.min}
            onChange={(event) => onDraftChange({ ...draftRange, min: event.target.value })}
            aria-label={minPlaceholder}
          />
          <AdminFilterInput
            type="number"
            min={min}
            max={max}
            placeholder={maxPlaceholder}
            value={draftRange.max}
            onChange={(event) => onDraftChange({ ...draftRange, max: event.target.value })}
            aria-label={maxPlaceholder}
          />
        </div>
      </div>
      <div className={adminRangeFilterTokenClasses.actionsGrid}>
        <button type="button" className={adminRangeFilterTokenClasses.confirmButton} onClick={onConfirm}>
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
