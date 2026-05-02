'use client';

import EditableChipMenu, { type EditableChipMenuOption } from '@/shared/ui/badge/editable-chip-menu';
import { getAdminStatusInfoMenuOptionClassName } from '@/shared/ui/theme/tokens';

export const getActiveStateMenuItemClassName = (active: boolean) =>
  getAdminStatusInfoMenuOptionClassName(active ? 'success' : 'neutral');

const ACTIVE_STATE_OPTIONS: ReadonlyArray<EditableChipMenuOption<boolean>> = [
  { value: true, label: 'Aktiven', className: getActiveStateMenuItemClassName(true) },
  { value: false, label: 'Neaktiven', className: getActiveStateMenuItemClassName(false) }
];

export default function ActiveStateChip({
  active,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom',
  editScope
}: {
  active: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
  editScope?: string;
}) {
  return (
    <EditableChipMenu
      label={active ? 'Aktiven' : 'Neaktiven'}
      variant={active ? 'success' : 'neutral'}
      editable={editable}
      options={ACTIVE_STATE_OPTIONS}
      onChange={onChange}
      chipClassName={chipClassName}
      menuPlacement={menuPlacement}
      editScope={editScope}
    />
  );
}
