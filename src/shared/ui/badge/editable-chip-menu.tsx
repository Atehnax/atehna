'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MenuItem from '@/shared/ui/menu/menu-item';
import MenuPanel from '@/shared/ui/menu/menu-panel';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import Chip, { type ChipProps } from './chip';

type EditableChipMenuValue = string | number | boolean;

export type EditableChipMenuOption<Value extends EditableChipMenuValue> = {
  value: Value;
  label: ReactNode;
  className?: string;
  disabled?: boolean;
};

type EditableChipMenuProps<Value extends EditableChipMenuValue> = {
  label: ReactNode;
  variant: ChipProps['variant'];
  editable: boolean;
  options: ReadonlyArray<EditableChipMenuOption<Value>>;
  onChange: (next: Value) => void;
  chipClassName?: string;
  chipEmphasisClassName?: string;
  menuPlacement?: 'top' | 'bottom';
  editScope?: string;
  minMenuWidth?: number;
};

export default function EditableChipMenu<Value extends EditableChipMenuValue>({
  label,
  variant,
  editable,
  options,
  onChange,
  chipClassName,
  chipEmphasisClassName,
  menuPlacement = 'bottom',
  editScope,
  minMenuWidth = 130
}: EditableChipMenuProps<Value>) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const dismissRefs = useMemo(() => [rootRef, menuRef], []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(minMenuWidth, menuRef.current?.offsetWidth ?? minMenuWidth);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement, minMenuWidth]);

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeMenu
  });

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();

    const onWindowChange = () => updateMenuPosition();

    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);

    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative" data-edit-scope={editScope}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{'\u25be'}</span> : null}
        <span className="block">
          <Chip size="adminStatusInfo" variant={variant} className={`${chipEmphasisClassName ?? ''} ${chipClassName ?? ''}`.trim()}>{label}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-edit-scope={editScope}
              className={`fixed z-[1000] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left, minWidth: minMenuWidth }}
            >
              <MenuPanel>
                {options.map((option) => (
                  <MenuItem
                    key={String(option.value)}
                    className={option.className}
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
