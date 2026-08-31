'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';

export type AdminChipDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

type AdminChipDropdownProps = {
  value: string;
  options: ReadonlyArray<AdminChipDropdownOption>;
  onChange: (value: string) => void;
  renderChip: (value: string) => ReactNode;
  disabled?: boolean;
  showArrow?: boolean;
  interactive?: boolean;
  optionClassName?: (value: string) => string;
  ariaLabel?: string;
  testId?: string;
  menuClassName?: string;
};

type MenuFocusTarget = 'selected' | 'first' | 'last';

export function AdminChipDropdown({
  value,
  options,
  onChange,
  renderChip,
  disabled = false,
  showArrow = true,
  interactive = true,
  optionClassName,
  ariaLabel,
  testId,
  menuClassName
}: AdminChipDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuFocusTargetRef = useRef<MenuFocusTarget>('selected');
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const closeMenuAndRestoreFocus = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const dismissRefs = useMemo(() => [containerRef, menuRef], []);
  const hasDescriptions = options.some((option) => Boolean(option.description));

  const openMenu = useCallback(
    (focusTarget: MenuFocusTarget) => {
      if (disabled || !interactive) return;
      menuFocusTargetRef.current = focusTarget;
      setIsOpen(true);
    },
    [disabled, interactive]
  );

  const updateMenuRect = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const minimumWidth = hasDescriptions ? 280 : 150;
    const availableWidth = Math.max(150, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, minimumWidth), availableWidth);
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8)
    );
    const nextRect = {
      left,
      top: rect.bottom + 4,
      width
    };
    setMenuRect((current) =>
      current &&
      current.left === nextRect.left &&
      current.top === nextRect.top &&
      current.width === nextRect.width
        ? current
        : nextRect
    );
  }, [hasDescriptions]);

  useDropdownDismiss({
    open: isOpen,
    refs: dismissRefs,
    onClose: closeMenu,
    returnFocusRef: triggerRef
  });

  useEffect(() => {
    if (!isOpen) {
      setMenuRect(null);
      return;
    }

    updateMenuRect();
    window.addEventListener('resize', updateMenuRect);
    window.addEventListener('scroll', updateMenuRect, true);
    return () => {
      window.removeEventListener('resize', updateMenuRect);
      window.removeEventListener('scroll', updateMenuRect, true);
    };
  }, [isOpen, updateMenuRect]);

  useEffect(() => {
    if (!isOpen || !menuRect) return;
    const frame = window.requestAnimationFrame(() => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
      );
      const selectedItem = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"][data-menu-item-active="true"]'
      );
      const target =
        menuFocusTargetRef.current === 'last'
          ? items[items.length - 1]
          : menuFocusTargetRef.current === 'first'
            ? items[0]
            : selectedItem ?? items[0];
      target?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, menuRect]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openMenu(event.key === 'ArrowUp' ? 'last' : 'first');
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenuAndRestoreFocus();
      return;
    }
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;

    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowUp'
            ? (Math.max(0, currentIndex) - 1 + items.length) % items.length
            : (Math.max(-1, currentIndex) + 1) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled || !interactive) return;
          if (isOpen) {
            closeMenu();
            return;
          }
          openMenu('selected');
        }}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={interactive ? isOpen : false}
        aria-controls={isOpen ? menuId : undefined}
        data-testid={testId}
        className="relative block rounded-md focus:outline-none disabled:cursor-default disabled:opacity-60"
      >
        {showArrow ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            ▾
          </span>
        ) : null}
        <span className="block">{renderChip(value)}</span>
      </button>

      {isOpen && menuRect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={ariaLabel}
              className="fixed z-[1100]"
              style={{
                left: menuRect.left,
                top: menuRect.top,
                minWidth: menuRect.width
              }}
              onKeyDown={handleMenuKeyDown}
            >
              <MenuPanel className={'w-full min-w-[150px] ' + (menuClassName ?? '')}>
                {options.map((option, index) => {
                  const descriptionId = option.description
                    ? menuId + '-option-' + index + '-description'
                    : undefined;
                  const describedOptionClassName = option.description
                    ? '!h-auto min-h-10 !items-start py-2'
                    : '';
                  const blockedOptionClassName = option.disabled
                    ? '!cursor-not-allowed !text-slate-400 hover:!bg-transparent hover:!text-slate-400'
                    : '';

                  return (
                    <MenuItem
                      key={option.value}
                      isActive={option.value === value}
                      ariaDisabled={option.disabled}
                      ariaDescribedBy={descriptionId}
                      className={
                        [
                          optionClassName?.(option.value),
                          describedOptionClassName,
                          blockedOptionClassName
                        ]
                          .filter(Boolean)
                          .join(' ')
                      }
                      onClick={() => {
                        if (option.disabled) return;
                        onChange(option.value);
                        closeMenuAndRestoreFocus();
                      }}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="min-w-0">{option.label}</span>
                        {option.description ? (
                          <span
                            id={descriptionId}
                            className="mt-0.5 text-[10px] font-normal leading-4 text-slate-500"
                          >
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </MenuItem>
                  );
                })}
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
