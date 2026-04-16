'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip } from '@/shared/ui/badge';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';

export type NoteTag = 'novo' | 'akcija' | 'zadnji-kosi' | 'ni-na-zalogi';
type NoteTagValue = NoteTag | '';

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
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label =
    value === ''
      ? placeholderLabel
      : value === 'novo'
      ? 'Novo'
      : value === 'akcija'
        ? 'V akciji'
        : value === 'ni-na-zalogi'
          ? 'Ni na zalogi'
          : 'Zadnji kosi';
  const variant = value === '' ? 'neutral' : value === 'novo' ? 'info' : value === 'akcija' ? 'danger' : value === 'ni-na-zalogi' ? 'neutral' : 'purple';
  const emphasisClassName = value === 'akcija' ? '!border-rose-200 !bg-rose-50 !text-rose-700' : value === '' ? 'text-slate-600' : '';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(130, menuRef.current?.offsetWidth ?? 130);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
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
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant={variant} className={`${chipClassName ?? ''} ${emphasisClassName}`.trim()}>{label}</Chip>
        </span>
      </button>
      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-edit-scope={editScope}
              className={`fixed z-[1000] min-w-[130px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                {allowEmpty ? <MenuItem onClick={() => { onChange(''); setIsOpen(false); }}>{placeholderLabel}</MenuItem> : null}
                <MenuItem onClick={() => { onChange('novo'); setIsOpen(false); }}>Novo</MenuItem>
                <MenuItem onClick={() => { onChange('akcija'); setIsOpen(false); }}>V akciji</MenuItem>
                <MenuItem onClick={() => { onChange('zadnji-kosi'); setIsOpen(false); }}>Zadnji kosi</MenuItem>
                <MenuItem onClick={() => { onChange('ni-na-zalogi'); setIsOpen(false); }}>Ni na zalogi</MenuItem>
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
