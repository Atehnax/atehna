'use client';

import EditableChipMenu, { type EditableChipMenuOption } from '@/shared/ui/badge/editable-chip-menu';
import type { BadgeVariant } from '@/shared/ui/badge';
import { getAdminStatusInfoMenuOptionClassName } from '@/shared/ui/theme/tokens';

export type NoteTag = 'na-zalogi' | 'novo' | 'akcija' | 'zadnji-kosi' | 'ni-na-zalogi';
export type NoteTagValue = NoteTag | '';

export const NOTE_TAG_OPTIONS: ReadonlyArray<{ value: NoteTag; label: string }> = [
  { value: 'na-zalogi', label: 'Na zalogi' },
  { value: 'novo', label: 'Novo' },
  { value: 'akcija', label: 'V akciji' },
  { value: 'zadnji-kosi', label: 'Zadnji kosi' },
  { value: 'ni-na-zalogi', label: 'Ni na zalogi' }
];

const NOTE_TAG_LABELS: Record<NoteTag, string> = {
  'na-zalogi': 'Na zalogi',
  novo: 'Novo',
  akcija: 'V akciji',
  'zadnji-kosi': 'Zadnji kosi',
  'ni-na-zalogi': 'Ni na zalogi'
};

const NOTE_TAG_VARIANTS: Record<NoteTag, BadgeVariant> = {
  'na-zalogi': 'success',
  novo: 'info',
  akcija: 'danger',
  'zadnji-kosi': 'purple',
  'ni-na-zalogi': 'neutral'
};

const isNoteTag = (value: string): value is NoteTag =>
  NOTE_TAG_OPTIONS.some((option) => option.value === value);

export const normalizeNoteTagValue = (value: string | null | undefined): NoteTagValue => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'opomba') return 'na-zalogi';
  return isNoteTag(normalized) ? normalized : '';
};

export const getNoteTagLabel = (value: NoteTagValue, emptyLabel = 'Brez opombe') =>
  value === '' ? emptyLabel : NOTE_TAG_LABELS[value];

const getNoteTagVariant = (value: NoteTagValue): BadgeVariant =>
  value === '' ? 'neutral' : NOTE_TAG_VARIANTS[value];

const getNoteTagEmphasisClassName = (value: NoteTagValue) =>
  value === 'akcija' ? '!border-rose-200 !bg-rose-50 !text-rose-700' : value === '' ? 'text-slate-600' : '';

export const getNoteTagMenuItemClassName = (value: NoteTagValue) =>
  getAdminStatusInfoMenuOptionClassName(
    value === 'na-zalogi'
      ? 'success'
      : value === 'novo'
        ? 'info'
        : value === 'akcija'
          ? 'rose'
          : value === 'zadnji-kosi'
            ? 'purple'
            : 'neutral'
  );

export function NoteTagChip({
  value,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom',
  allowEmpty = false,
  placeholderLabel = 'Opombe',
  editScope
}: {
  value: NoteTagValue;
  editable: boolean;
  onChange: (next: NoteTagValue) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
  allowEmpty?: boolean;
  placeholderLabel?: string;
  editScope?: string;
}) {
  const options: Array<EditableChipMenuOption<NoteTagValue>> = [
    ...(allowEmpty
      ? [{ value: '' as NoteTagValue, label: placeholderLabel, className: getNoteTagMenuItemClassName('') }]
      : []),
    ...NOTE_TAG_OPTIONS.map((option): EditableChipMenuOption<NoteTagValue> => ({
      value: option.value,
      label: option.label,
      className: getNoteTagMenuItemClassName(option.value)
    }))
  ];

  return (
    <EditableChipMenu
      label={getNoteTagLabel(value, placeholderLabel)}
      variant={getNoteTagVariant(value)}
      editable={editable}
      options={options}
      onChange={onChange}
      chipClassName={chipClassName}
      chipEmphasisClassName={getNoteTagEmphasisClassName(value)}
      menuPlacement={menuPlacement}
      editScope={editScope}
    />
  );
}
