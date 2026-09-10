'use client';

import EditableChipMenu, { type EditableChipMenuOption } from '@/shared/ui/badge/editable-chip-menu';
import { getAdminStatusInfoMenuOptionClassName } from '@/shared/ui/theme/tokens';
import { getArticleNoteTagsSnapshot, useArticleNoteTags } from '@/shared/client/articleNoteTags';
import {
  DEFAULT_ARTICLE_NOTE_TAGS, getArticleNoteDefinition, getArticleNoteOptions, getArticleNoteStyle,
  type ArticleNoteTagDefinition
} from '@/shared/domain/catalog/articleNotes';

export { normalizeNoteTagValue, getArticleNoteOptions } from '@/shared/domain/catalog/articleNotes';
export { useArticleNoteTags } from '@/shared/client/articleNoteTags';
export type NoteTag = string;
export type NoteTagValue = string;
export const NOTE_TAG_OPTIONS = getArticleNoteOptions(DEFAULT_ARTICLE_NOTE_TAGS);

export const getNoteTagLabel = (value: NoteTagValue, emptyLabel?: string, tags: readonly ArticleNoteTagDefinition[] = getArticleNoteTagsSnapshot()) =>
  value === '' && emptyLabel ? emptyLabel : getArticleNoteDefinition(value, tags).label;
export const getNoteTagColor = (value: NoteTagValue, tags: readonly ArticleNoteTagDefinition[] = getArticleNoteTagsSnapshot()) => getArticleNoteDefinition(value, tags).color;
export const getNoteTagStyle = (value: NoteTagValue, tags: readonly ArticleNoteTagDefinition[] = getArticleNoteTagsSnapshot()) => getArticleNoteStyle(value, tags);
export const getNoteTagMenuItemClassName = (_value: NoteTagValue) => getAdminStatusInfoMenuOptionClassName('neutral');

export function NoteTagChip({
  value,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom',
  allowEmpty = false,
  placeholderLabel,
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
  const tags = useArticleNoteTags();
  const options: Array<EditableChipMenuOption<NoteTagValue>> = [
    ...(allowEmpty ? [{ value: '', label: placeholderLabel ?? getNoteTagLabel('', undefined, tags) }] : []),
    ...getArticleNoteOptions(tags, value).filter((option) => !allowEmpty || option.value !== 'na-zalogi').map((option) => ({
      value: option.value,
      label: <span className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getNoteTagColor(option.value, tags) }} />{option.label}</span>,
      className: getNoteTagMenuItemClassName(option.value)
    }))
  ];

  return (
    <EditableChipMenu
      label={getNoteTagLabel(value, placeholderLabel, tags)}
      variant="neutral"
      editable={editable}
      options={options}
      onChange={onChange}
      chipClassName={chipClassName}
      chipStyle={getNoteTagStyle(value, tags)}
      menuPlacement={menuPlacement}
      editScope={editScope}
    />
  );
}
