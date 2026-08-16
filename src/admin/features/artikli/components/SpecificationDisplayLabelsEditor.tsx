'use client';

import {
  RotateCcw,
  type LucideIcon
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  normalizeCatalogSpecificationToken,
  validateAndNormalizeCatalogSpecificationLabels
} from '@/shared/domain/catalog/catalogSpecification';
import {
  adminControlFocusTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';

export type SpecificationDisplayLabelRow = {
  key: string;
  label: string;
  canonicalLabel?: string;
  value: string;
  valueEditor?: ReactNode;
};

type SpecificationDisplayLabelsEditorProps = {
  rows: readonly SpecificationDisplayLabelRow[];
  labels: Readonly<Record<string, string>>;
  onChange: (labels: Record<string, string>) => void;
  disabled?: boolean;
  surface: 'article-editor' | 'appearance-editor';
  reservedLabels?: readonly string[];
};

const inputClassName =
  `h-8 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${adminInputFocusTokenClasses}`;

function labelDrafts(
  rows: readonly SpecificationDisplayLabelRow[],
  labels: Readonly<Record<string, string>>
) {
  return Object.fromEntries(
    rows.map((row) => [row.key, labels[row.key] ?? row.label])
  );
}

function IconButton({
  icon: Icon,
  label,
  disabled,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 ${adminControlFocusTokenClasses}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

export default function SpecificationDisplayLabelsEditor({
  rows,
  labels,
  onChange,
  disabled = false,
  surface,
  reservedLabels = []
}: SpecificationDisplayLabelsEditorProps) {
  const syncKey = useMemo(
    () => JSON.stringify(rows.map((row) => [row.key, row.label, labels[row.key] ?? null])),
    [labels, rows]
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(
    () => labelDrafts(rows, labels)
  );
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const skipBlurCommitRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const synchronizedRows = JSON.parse(syncKey) as Array<[
      string,
      string,
      string | null
    ]>;
    setDrafts(Object.fromEntries(
      synchronizedRows.map(([key, label, override]) => [key, override ?? label])
    ));
    setInvalidKey(null);
  }, [syncKey]);

  const labelMapIsCompatible = (candidateLabels: Record<string, string>) => {
    if (!validateAndNormalizeCatalogSpecificationLabels(candidateLabels).ok) {
      return false;
    }
    const usedTokens = new Set(
      reservedLabels.map(normalizeCatalogSpecificationToken).filter(Boolean)
    );
    for (const candidate of rows) {
      const effectiveLabel = candidateLabels[candidate.key]
        ?? candidate.canonicalLabel
        ?? candidate.label;
      const token = normalizeCatalogSpecificationToken(effectiveLabel);
      if (!token || usedTokens.has(token)) return false;
      usedTokens.add(token);
    }
    return true;
  };

  const labelIsValid = (row: SpecificationDisplayLabelRow, nextLabel: string) => {
    const trimmedLabel = nextLabel.trim();
    if (!trimmedLabel) return false;
    const candidateLabels = { ...labels };
    if (trimmedLabel === (row.canonicalLabel ?? row.label).trim()) {
      delete candidateLabels[row.key];
    } else {
      candidateLabels[row.key] = trimmedLabel;
    }
    return labelMapIsCompatible(candidateLabels);
  };

  const commitLabel = (row: SpecificationDisplayLabelRow) => {
    const nextLabel = drafts[row.key] ?? labels[row.key] ?? row.label;
    const trimmedLabel = nextLabel.trim();
    if (!labelIsValid(row, nextLabel)) {
      setInvalidKey(row.key);
      return;
    }

    setInvalidKey(null);
    const currentLabel = labels[row.key] ?? row.label;
    if (trimmedLabel === currentLabel.trim()) return;
    if (trimmedLabel === (row.canonicalLabel ?? row.label).trim()) {
      const nextLabels = { ...labels };
      delete nextLabels[row.key];
      onChange(nextLabels);
      return;
    }
    onChange({
      ...labels,
      [row.key]: trimmedLabel
    });
  };

  const restoreDefaultLabel = (row: SpecificationDisplayLabelRow) => {
    const nextLabels = { ...labels };
    delete nextLabels[row.key];
    if (!labelMapIsCompatible(nextLabels)) {
      setInvalidKey(row.key);
      return;
    }
    setDrafts((current) => ({
      ...current,
      [row.key]: row.canonicalLabel ?? row.label
    }));
    setInvalidKey(null);
    onChange(nextLabels);
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-[10px] leading-4 text-slate-500">
        Artikel še nima prikazanih sistemskih specifikacij.
      </p>
    );
  }

  return (
    <div
      data-testid="specification-display-labels-editor"
      data-specification-labels-surface={surface}
      className="grid gap-2"
    >
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_32px] gap-2 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Prikazni naziv</span>
        <span>Vrednost</span>
        <span className="sr-only">Ponastavi</span>
      </div>
      {rows.map((row) => {
        const hasOverride = Object.prototype.hasOwnProperty.call(labels, row.key);
        const resetLabels = { ...labels };
        delete resetLabels[row.key];
        const resetWouldConflict = !labelMapIsCompatible(resetLabels);
        const invalid = invalidKey === row.key;
        return (
          <div
            key={row.key}
            data-testid="specification-display-label-row"
            data-specification-key={row.key}
            className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_32px] items-start gap-2"
          >
            <label className="grid min-w-0 gap-1">
              <span className="sr-only">Prikazni naziv za {row.label}</span>
              <input
                value={drafts[row.key] ?? labels[row.key] ?? row.label}
                disabled={disabled}
                data-testid={`specification-display-label-${row.key}`}
                aria-label={`Prikazni naziv specifikacije ${row.label}`}
                aria-invalid={invalid || undefined}
                maxLength={100}
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setDrafts((current) => ({ ...current, [row.key]: nextLabel }));
                  setInvalidKey(labelIsValid(row, nextLabel) ? null : row.key);
                }}
                onBlur={() => {
                  if (skipBlurCommitRef.current.delete(row.key)) return;
                  if (invalid) {
                    setDrafts((current) => ({
                      ...current,
                      [row.key]: labels[row.key] ?? row.label
                    }));
                    setInvalidKey(null);
                    return;
                  }
                  commitLabel(row);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!invalid) {
                      commitLabel(row);
                      skipBlurCommitRef.current.add(row.key);
                    }
                    event.currentTarget.blur();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    skipBlurCommitRef.current.add(row.key);
                    setDrafts((current) => ({
                      ...current,
                      [row.key]: labels[row.key] ?? row.label
                    }));
                    setInvalidKey(null);
                    event.currentTarget.blur();
                  }
                }}
                className={`${inputClassName} ${invalid ? 'border-red-400' : ''}`}
              />
              {invalid ? (
                <span className="text-[9px] leading-3 text-red-600">
                  Naziv mora biti izpolnjen in enoličen.
                </span>
              ) : null}
            </label>
            {row.valueEditor ?? (
              <div
                data-testid={`specification-display-value-${row.key}`}
                className="flex min-h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600"
              >
                {row.value}
              </div>
            )}
            <IconButton
              icon={RotateCcw}
              label={`Ponastavi prikazni naziv ${row.label}`}
              disabled={disabled || !hasOverride || resetWouldConflict}
              onClick={() => restoreDefaultLabel(row)}
            />
          </div>
        );
      })}
    </div>
  );
}
