'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject
} from 'react';
import { createPortal } from 'react-dom';
import {
  isGursPostalLookupQueryEligible,
  normalizeAddressSearchText,
  type GursPostalLocation,
  type GursPostalLookupResponse,
  type PostalLookupField
} from '@/shared/domain/address/gursAddress';

const POSTAL_LOOKUP_FOLLOW_UP_DEBOUNCE_MS = 50;

type PostalLookupStatus = 'idle' | 'loading' | 'ready' | 'error';

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
};

function isPostalLocation(value: unknown): value is GursPostalLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<GursPostalLocation>;
  return (
    typeof location.postalCode === 'string' &&
    /^\d{4}$/u.test(location.postalCode) &&
    typeof location.postalName === 'string' &&
    location.postalName.trim().length > 0
  );
}

function isExactPostalLocation(
  field: PostalLookupField,
  value: string,
  location: GursPostalLocation
) {
  if (field === 'postalCode') {
    const postalCode = value.trim();
    return /^\d{4}$/u.test(postalCode) && location.postalCode === postalCode;
  }

  return (
    normalizeAddressSearchText(location.postalName) ===
    normalizeAddressSearchText(value)
  );
}

function lookupValue(
  field: PostalLookupField,
  location: GursPostalLocation
) {
  return field === 'postalCode' ? location.postalCode : location.postalName;
}

export default function AdminPostalLocationCombobox({
  field,
  value,
  disabled = false,
  className = '',
  testId,
  'aria-label': ariaLabel,
  editSequenceRef,
  onChange,
  onResolve
}: {
  field: PostalLookupField;
  value: string;
  disabled?: boolean;
  className?: string;
  testId: string;
  'aria-label'?: string;
  editSequenceRef: MutableRefObject<number>;
  onChange: (value: string) => void;
  onResolve: (location: GursPostalLocation) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isActiveRef = useRef(false);
  const lookupWasUserEditedRef = useRef(false);
  const skipLookupValueRef = useRef<string | null>(null);
  const onResolveRef = useRef(onResolve);
  const listboxId = useId();
  const [isActive, setIsActive] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GursPostalLocation[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<PostalLookupStatus>('idle');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    onResolveRef.current = onResolve;
  }, [onResolve]);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (skipLookupValueRef.current === value) {
      skipLookupValueRef.current = null;
      lookupWasUserEditedRef.current = false;
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }
    skipLookupValueRef.current = null;

    const shouldLookup = lookupWasUserEditedRef.current;
    lookupWasUserEditedRef.current = false;
    if (
      disabled ||
      !shouldLookup ||
      !isGursPostalLookupQueryEligible(field, value)
    ) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }

    const query = value.trim();
    const editSequence = editSequenceRef.current;
    setStatus('loading');
    setActiveIndex(-1);

    const lookup = async () => {
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const response = await fetch(
          `/api/addresses/postal-lookup?field=${field}&query=${encodeURIComponent(query)}`,
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error('Postal lookup failed.');

        const payload =
          (await response.json()) as Partial<GursPostalLookupResponse>;
        if (controller.signal.aborted || requestRef.current !== controller) {
          return;
        }
        if (editSequenceRef.current !== editSequence) {
          setSuggestions([]);
          setIsOpen(false);
          setActiveIndex(-1);
          setStatus('idle');
          return;
        }

        const results = Array.isArray(payload.results)
          ? payload.results.filter(isPostalLocation).slice(0, 8)
          : [];
        const exactMatches = results.filter((location) =>
          isExactPostalLocation(field, query, location)
        );

        setActiveIndex(-1);
        setStatus('ready');

        if (exactMatches.length === 1) {
          const exactMatch = exactMatches[0];
          skipLookupValueRef.current = lookupValue(field, exactMatch);
          setSuggestions([]);
          setIsOpen(false);
          setStatus('idle');
          onResolveRef.current(exactMatch);
          return;
        }

        setSuggestions(results);
        setIsOpen(isActiveRef.current && results.length > 0);
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        if (editSequenceRef.current !== editSequence) {
          setSuggestions([]);
          setIsOpen(false);
          setActiveIndex(-1);
          setStatus('idle');
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

    const startsImmediately =
      field === 'postalCode' && /^\d{4}$/u.test(query);
    const timeoutId = startsImmediately
      ? null
      : window.setTimeout(() => {
          void lookup();
        }, POSTAL_LOOKUP_FOLLOW_UP_DEBOUNCE_MS);

    if (startsImmediately) void lookup();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      requestRef.current?.abort();
    };
  }, [disabled, editSequenceRef, field, value]);

  useEffect(() => {
    const hasVisiblePopup =
      isActive &&
      (status === 'loading' ||
        status === 'error' ||
        (status === 'ready' && (isOpen || suggestions.length === 0)));
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
        Math.max(260, rect.width),
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

  const chooseLocation = (location: GursPostalLocation) => {
    editSequenceRef.current += 1;
    skipLookupValueRef.current = lookupValue(field, location);
    lookupWasUserEditedRef.current = false;
    onResolveRef.current(location);
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
      const location = suggestions[activeIndex];
      if (!location) return;
      event.preventDefault();
      chooseLocation(location);
    }
  };

  const statusMessage =
    status === 'loading'
      ? 'Iščem poštne podatke.'
      : status === 'ready'
        ? suggestions.length > 0
          ? String(suggestions.length) + ' predlogov poštnih podatkov.'
          : 'Ni predlogov poštnih podatkov.'
        : status === 'error'
          ? 'Iskanje poštnih podatkov trenutno ni na voljo. Podatke lahko vnesete ročno.'
          : '';
  const showStatusFeedback =
    isActive &&
    menuPosition &&
    ((status === 'loading' && suggestions.length === 0) ||
      status === 'error' ||
      (status === 'ready' && suggestions.length === 0));
  const listLabel =
    field === 'postalCode'
      ? 'Predlogi poštnih številk'
      : 'Predlogi poštnih krajev';
  const label =
    ariaLabel ?? (field === 'postalCode' ? 'Poštna številka' : 'Kraj');

  return (
    <div className="relative min-w-0">
      <input
        ref={inputRef}
        aria-label={label}
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
        autoComplete={field === 'postalCode' ? 'postal-code' : 'address-level2'}
        type="text"
        inputMode={field === 'postalCode' ? 'numeric' : 'text'}
        maxLength={field === 'postalCode' ? 4 : undefined}
        value={value}
        disabled={disabled}
        placeholder={field === 'postalCode' ? 'P. št.' : 'Kraj'}
        onChange={(event) => {
          editSequenceRef.current += 1;
          lookupWasUserEditedRef.current = true;
          skipLookupValueRef.current = null;
          onChange(event.target.value);
        }}
        onFocus={() => {
          isActiveRef.current = true;
          setIsActive(true);
          if (suggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          isActiveRef.current = false;
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
      {showStatusFeedback && typeof document !== 'undefined'
        ? createPortal(
            <div
              role={status === 'error' ? 'alert' : 'status'}
              data-testid={testId + '-' + status}
              className={
                'fixed z-[150] rounded-md border px-3 py-2 text-[11px] leading-4 shadow-sm ' +
                (status === 'error'
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
              aria-label={listLabel}
              aria-busy={status === 'loading'}
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
                  key={suggestion.postalCode + '-' + suggestion.postalName}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={listboxId + '-option-' + String(index)}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => chooseLocation(suggestion)}
                  className={
                    'block w-full rounded-md px-2.5 py-2 text-left transition focus:outline-none ' +
                    (activeIndex === index
                      ? 'bg-[color:var(--hover-neutral)]'
                      : 'hover:bg-[color:var(--hover-neutral)]')
                  }
                >
                  <span className="text-[12px] font-semibold leading-4 text-slate-800">
                    {suggestion.postalCode}
                  </span>{' '}
                  <span className="text-[11px] leading-4 text-slate-500">
                    {suggestion.postalName}
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
