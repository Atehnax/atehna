'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import {
  isGursPostalLookupQueryEligible,
  normalizeAddressSearchText,
  type GursPostalLocation,
  type GursPostalLookupResponse,
  type PostalLookupField
} from '@/shared/domain/address/gursAddress';
import { FloatingInput } from '@/shared/ui/floating-field';

type PostalLookupStatus = 'idle' | 'loading' | 'ready' | 'error';

type PostalLocationComboboxProps = {
  field: PostalLookupField;
  value: string;
  label: string;
  error?: string;
  disabled?: boolean;
  lookupEnabled: boolean;
  onChange: (value: string) => void;
  onResolve: (location: GursPostalLocation) => void;
};

function isPostalLocation(value: unknown): value is GursPostalLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Record<string, unknown>;
  return (
    typeof location.postalCode === 'string' &&
    /^\d{4}$/.test(location.postalCode) &&
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
    return /^\d{4}$/.test(postalCode) && location.postalCode === postalCode;
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

export default function PostalLocationCombobox({
  field,
  value,
  label,
  error,
  disabled = false,
  lookupEnabled,
  onChange,
  onResolve
}: PostalLocationComboboxProps) {
  const [suggestions, setSuggestions] = useState<GursPostalLocation[]>([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<PostalLookupStatus>('idle');
  const requestRef = useRef<AbortController | null>(null);
  const skipLookupValueRef = useRef<string | null>(null);
  const listboxId = useId();
  const inputId = field === 'postalCode' ? 'postalCode' : 'city';
  const listLabel =
    field === 'postalCode'
      ? 'Predlogi poštnih številk'
      : 'Predlogi poštnih krajev';

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;

    if (skipLookupValueRef.current === value) {
      skipLookupValueRef.current = null;
      setSuggestions([]);
      setIsListOpen(false);
      setActiveIndex(-1);
      return;
    }
    skipLookupValueRef.current = null;

    if (
      disabled ||
      !lookupEnabled ||
      !isActive ||
      !isGursPostalLookupQueryEligible(field, value)
    ) {
      setSuggestions([]);
      setIsListOpen(false);
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }

    const query = value.trim();
    const timeoutId = window.setTimeout(async () => {
      const controller = new AbortController();
      requestRef.current = controller;
      setStatus('loading');

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
          setIsListOpen(false);
          onResolve(exactMatch);
          return;
        }

        setSuggestions(results);
        setIsListOpen(results.length > 0);
      } catch (fetchError) {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller ||
          (fetchError instanceof Error && fetchError.name === 'AbortError')
        ) {
          return;
        }
        setSuggestions([]);
        setIsListOpen(false);
        setActiveIndex(-1);
        setStatus('error');
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      requestRef.current?.abort();
    };
  }, [
    disabled,
    field,
    isActive,
    lookupEnabled,
    onResolve,
    value
  ]);

  const selectLocation = (location: GursPostalLocation) => {
    skipLookupValueRef.current = lookupValue(field, location);
    onResolve(location);
    setSuggestions([]);
    setIsListOpen(false);
    setActiveIndex(-1);
    setStatus('ready');
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsListOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsListOpen(true);
      setActiveIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsListOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
      return;
    }
    if (event.key === 'Enter' && isListOpen && activeIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeIndex];
      if (suggestion) selectLocation(suggestion);
    }
  };

  const handleBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsActive(false);
    setIsListOpen(false);
    setActiveIndex(-1);
  };

  const statusMessage =
    status === 'loading'
      ? 'Iščemo poštne podatke …'
      : status === 'ready'
        ? suggestions.length > 0
          ? `Na voljo je ${suggestions.length} predlogov.`
          : 'Poštne podatke lahko vnesete tudi ročno.'
        : status === 'error'
          ? 'Predlogi trenutno niso na voljo. Poštne podatke lahko vnesete ročno.'
          : '';
  const describedBy = [
    `${listboxId}-status`,
    error ? `${inputId}-error` : undefined
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="relative"
      onFocusCapture={() => {
        setIsActive(true);
        if (suggestions.length > 0) setIsListOpen(true);
      }}
      onBlurCapture={handleBlur}
    >
      <FloatingInput
        id={inputId}
        label={label}
        tone="order"
        shellClassName={`storefront-checkout-input-shell ${
          error ? '!border-[color:var(--site-color-danger)]' : ''
        }`}
        className="storefront-checkout-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        inputMode={field === 'postalCode' ? 'numeric' : 'text'}
        pattern={field === 'postalCode' ? '[0-9]{4}' : undefined}
        maxLength={field === 'postalCode' ? 4 : undefined}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isListOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isListOpen && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
        required
      />
      {error ? (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-xs text-[color:var(--site-color-danger)]"
        >
          {error}
        </p>
      ) : null}
      <p
        id={`${listboxId}-status`}
        role="status"
        aria-live="polite"
        className={
          status === 'error'
            ? 'mt-1 text-xs text-[color:var(--site-color-text-muted)]'
            : 'sr-only'
        }
      >
        {statusMessage}
      </p>
      {!disabled && isListOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={listLabel}
          className="site-panel absolute z-20 mt-1 max-h-64 w-full overflow-auto p-1 text-sm"
        >
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.postalCode}-${suggestion.postalName}`}>
              <button
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => {
                  if (event.pointerType === 'mouse') event.preventDefault();
                }}
                onClick={() => selectLocation(suggestion)}
                className={`site-radius-sm w-full px-3 py-2 text-left transition ${
                  activeIndex === index
                    ? 'bg-[color:var(--site-color-surface-muted)]'
                    : 'hover:bg-[color:var(--site-color-surface-muted)]'
                }`}
              >
                <span className="font-semibold text-[color:var(--site-color-text)]">
                  {suggestion.postalCode}
                </span>{' '}
                <span className="text-[color:var(--site-color-text-muted)]">
                  {suggestion.postalName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
