'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react';
import { pillTokenClasses } from '@/shared/ui/theme/tokens';

type TabsVariant = 'default' | 'motion';

type TabsContextValue = {
  value: string;
  onValueChange: (next: string) => void;
  baseId: string;
  variant: TabsVariant;
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
  variant?: TabsVariant;
};

export function Tabs({ value, onValueChange, children, variant = 'default' }: TabsProps) {
  const baseId = useId();
  const contextValue = useMemo(
    () => ({ value, onValueChange, baseId, variant }),
    [value, onValueChange, baseId, variant]
  );

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>;
}

type TabsListProps = {
  children: ReactNode;
  className?: string;
};

export function TabsList({ children, className }: TabsListProps) {
  const { value, variant } = useTabsContext();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (variant !== 'motion') return;

    const list = listRef.current;
    if (!list) return;

    const updateIndicator = () => {
      const activeTrigger = list.querySelector<HTMLButtonElement>('[role="tab"][data-active="true"]');
      if (!activeTrigger) return;

      setIndicator({
        left: activeTrigger.offsetLeft,
        width: activeTrigger.offsetWidth
      });
    };

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(list);
    Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).forEach((tab) => {
      resizeObserver.observe(tab);
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [value, variant]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      className={classNames(
        variant === 'motion'
          ? 'relative inline-flex h-11 items-end gap-1 border-b border-slate-300 pb-1'
          : classNames(pillTokenClasses.list, 'h-8 gap-1 rounded-full px-1'),
        className
      )}
    >
      {variant === 'motion' ? (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-slate-200" />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 h-1 rounded bg-[#2749a5] transition-all duration-200 ease-out"
            style={{
              width: indicator?.width ?? 0,
              transform: `translateX(${indicator?.left ?? 0}px)`
            }}
          />
        </>
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
  const { value: selectedValue, onValueChange, baseId, variant } = useTabsContext();
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
        variant === 'motion'
          ? 'relative rounded-none px-5 py-2 text-base font-semibold transition-colors duration-200 ease-out text-slate-600 data-[active=true]:text-[#2749a5]'
          : classNames(
              'rounded-full px-3 py-1 text-xs',
              pillTokenClasses.itemBase,
              isActive ? pillTokenClasses.itemActive : pillTokenClasses.itemIdle
            ),
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
