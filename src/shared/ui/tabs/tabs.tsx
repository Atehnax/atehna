'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode
} from 'react';

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
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={classNames('inline-flex h-8 items-center gap-1 rounded-full border border-[#ede8ff] bg-white px-1', className)}
    >
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
      id={`${baseId}-trigger-${value}`}
      aria-controls={`${baseId}-panel-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      onKeyDown={handleKeyDown}
      className={classNames(
        'rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:border focus-visible:border-[#5d3ed6] focus-visible:outline-none focus-visible:ring-0',
        isActive ? 'border border-[#5d3ed6] bg-[#f8f7fc] text-[#5d3ed6]' : 'text-slate-700 hover:bg-slate-100',
        disabled && 'cursor-not-allowed opacity-50',
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
