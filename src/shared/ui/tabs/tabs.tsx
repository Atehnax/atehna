'use client';

import {
  createContext,
  useLayoutEffect,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { pillTokenClasses } from '@/shared/ui/theme/tokens';

type TabsContextValue = {
  value: string;
  onValueChange: (next: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

const classNames = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used inside <Tabs>');
  }
  return context;
}

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

export function Tabs({ value, onValueChange, children }: TabsProps) {
  const baseId = useId();
  const contextValue = useMemo(() => ({ value, onValueChange, baseId }), [value, onValueChange, baseId]);

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>;
}

type TabsListProps = {
  children: ReactNode;
  className?: string;
};

export function TabsList({ children, className }: TabsListProps) {
  const { value, baseId } = useTabsContext();
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const trigger = document.getElementById(`${baseId}-trigger-${value}`);
    const list = trigger?.closest('[role="tablist"]') as HTMLElement | null;
    if (!trigger || !list) return;

    const triggerRect = trigger.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    setIndicator({ left: triggerRect.left - listRect.left, width: triggerRect.width });
  }, [baseId, value, children]);

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={classNames(pillTokenClasses.list, 'relative h-8 gap-1 rounded-full px-1', className)}
    >
      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 top-1 rounded-full border border-[#3e67d6]/40 bg-white/95 shadow-sm transition-all duration-200"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {children}
    </div>
  );
}

type TabsTriggerProps = {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

export function TabsTrigger({ value, disabled, children, className }: TabsTriggerProps) {
  const { value: selectedValue, onValueChange, baseId } = useTabsContext();
  const isActive = selectedValue === value;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const list = triggerRef.current?.closest('[role="tablist"]');
      if (!list) return;

      const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
      const currentIndex = tabs.findIndex((tab) => tab === triggerRef.current);
      if (currentIndex === -1) return;

      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      const nextValue = nextTab.dataset.value;
      if (!nextValue) return;
      nextTab.focus();
      onValueChange(nextValue);
    },
    [onValueChange]
  );

  return (
    <button
      ref={triggerRef}
      type="button"
      role="tab"
      data-value={value}
      data-active={isActive ? 'true' : 'false'}
      id={`${baseId}-trigger-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      onKeyDown={handleKeyDown}
      className={classNames(
        'rounded-full px-3 py-1 text-xs',
        'relative z-[1] transition-colors duration-200',
        pillTokenClasses.itemBase,
        isActive ? pillTokenClasses.itemActive : pillTokenClasses.itemIdle,
        disabled && 'cursor-default opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
}

type TabsContentProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue, baseId } = useTabsContext();
  const isActive = selectedValue === value;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-trigger-${value}`}
      hidden={!isActive}
      className={className}
    >
      {isActive ? children : null}
    </div>
  );
}
