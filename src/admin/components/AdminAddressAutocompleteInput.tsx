'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { createPortal } from 'react-dom';
import {
  isAddressSearchQueryEligible,
  normalizeAddressSearchText,
  type GursAddressSearchResponse,
  type GursAddressSearchResult
} from '@/shared/domain/address/gursAddress';

const ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS = 50;

type AddressSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
};

const isGursAddressSearchResult = (
  value: unknown
): value is GursAddressSearchResult => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GursAddressSearchResult>;
  return (
    typeof candidate.gursHouseNumberId === 'string' &&
    typeof candidate.addressLine1 === 'string' &&
    typeof candidate.postalCode === 'string' &&
    typeof candidate.postalName === 'string' &&
    typeof candidate.settlementName === 'string' &&
    typeof candidate.municipalityName === 'string'
  );
};

export default function AdminAddressAutocompleteInput({
  value,
  gursHouseNumberId,
  disabled = false,
  className = '',
  testId,
  onChange,
  onSelect
}: {
  value: string;
  gursHouseNumberId: string;
  disabled?: boolean;
  className?: string;
  testId: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: GursAddressSearchResult) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const [isActive, setIsActive] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GursAddressSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<AddressSearchStatus>('idle');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (
      disabled ||
      !isActive ||
      gursHouseNumberId ||
      !isAddressSearchQueryEligible(value)
    ) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }

    const query = normalizeAddressSearchText(value);
    setStatus('loading');
    setActiveIndex(-1);

    const search = async () => {
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const response = await fetch(
          '/api/addresses/search?query=' + encodeURIComponent(query),
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error('Address search failed.');

        const payload = (await response.json()) as Partial<GursAddressSearchResponse>;
        if (controller.signal.aborted || requestRef.current !== controller) return;

        const results = Array.isArray(payload.results)
          ? payload.results.filter(isGursAddressSearchResult).slice(0, 8)
          : [];
        setSuggestions(results);
        setActiveIndex(-1);
        setIsOpen(results.length > 0);
        setStatus('ready');
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);
        setStatus('error');
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    };
    const startsImmediately = query.length === 1;
    const timeoutId = startsImmediately
      ? null
      : window.setTimeout(() => {
          void search();
        }, ADDRESS_SEARCH_FOLLOW_UP_DEBOUNCE_MS);

    if (startsImmediately) void search();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      requestRef.current?.abort();
    };
  }, [disabled, gursHouseNumberId, isActive, value]);

  useEffect(() => {
    const hasVisiblePopup =
      (isOpen && suggestions.length > 0) ||
      (isActive &&
        (status === 'error' ||
          (status === 'loading' && suggestions.length === 0) ||
          (status === 'ready' && suggestions.length === 0)));
    if (!hasVisiblePopup) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const viewportPadding = 8;
      const width = Math.min(
        Math.max(300, rect.width),
        window.innerWidth - viewportPadding * 2
      );
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      );
      const roomBelow = window.innerHeight - rect.bottom;
      const placement = roomBelow >= 180 ? 'bottom' : 'top';
      setMenuPosition({
        top: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
        left,
        width,
        placement
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isActive, isOpen, status, suggestions.length]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const chooseSuggestion = (suggestion: GursAddressSearchResult) => {
    onSelect(suggestion);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setStatus('idle');
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
      return;
    }
    if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      const suggestion = suggestions[activeIndex];
      if (!suggestion) return;
      event.preventDefault();
      chooseSuggestion(suggestion);
    }
  };

  const statusMessage =
    status === 'loading'
      ? 'Iščem naslove.'
      : status === 'ready'
        ? suggestions.length > 0
          ? String(suggestions.length) + ' predlogov naslovov.'
          : 'Ni predlogov naslovov.'
        : status === 'error'
          ? 'Iskanje naslovov trenutno ni na voljo. Naslov lahko vnesete ročno.'
          : '';
  const showLoadingFeedback =
    status === 'loading' && suggestions.length === 0 && isActive;
  const showEmptyFeedback =
    status === 'ready' && suggestions.length === 0 && isActive;
  const showErrorFeedback =
    status === 'error' && suggestions.length === 0 && isActive;

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        aria-label="Naslov"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={listboxId + '-status'}
        aria-expanded={isOpen}
        aria-busy={status === 'loading'}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? listboxId + '-option-' + String(activeIndex)
            : undefined
        }
        autoComplete="off"
        type="text"
        value={value}
        disabled={disabled}
        placeholder="Naslov"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setIsActive(true)}
        onBlur={() => {
          setIsActive(false);
          setIsOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className={className}
        data-testid={testId}
      />
      <span
        id={listboxId + '-status'}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {statusMessage}
      </span>
      {(showErrorFeedback || showEmptyFeedback || showLoadingFeedback) &&
      menuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              role={showErrorFeedback ? 'alert' : 'status'}
              data-testid={
                testId +
                (showErrorFeedback
                  ? '-error'
                  : showLoadingFeedback
                    ? '-loading'
                    : '-empty')
              }
              className={
                'fixed z-[150] rounded-md border px-3 py-2 text-[11px] leading-4 shadow-sm ' +
                (showErrorFeedback
                  ? 'border-amber-200 bg-amber-50 text-amber-800 '
                  : 'border-slate-200 bg-white text-slate-600 ') +
                (menuPosition.placement === 'top' ? '-translate-y-full' : '')
              }
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width
              }}
            >
              {statusMessage}
            </div>,
            document.body
          )
        : null}
      {isOpen && suggestions.length > 0 && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              aria-label="Predlogi naslovov"
              data-testid={testId + '-suggestions'}
              className={
                'fixed z-[150] max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-[0_14px_34px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.08)] ' +
                (menuPosition.placement === 'top' ? '-translate-y-full' : '')
              }
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width
              }}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.gursHouseNumberId}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={listboxId + '-option-' + String(index)}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                  className={
                    'block w-full rounded-md px-2.5 py-2 text-left transition focus:outline-none ' +
                    (activeIndex === index
                      ? 'bg-[color:var(--hover-neutral)]'
                      : 'hover:bg-[color:var(--hover-neutral)]')
                  }
                >
                  <span className="block truncate text-[12px] font-semibold leading-4 text-slate-800">
                    {suggestion.addressLine1}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-500">
                    {suggestion.postalCode} {suggestion.postalName}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
