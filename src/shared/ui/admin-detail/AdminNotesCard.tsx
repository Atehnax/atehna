'use client';

import { PencilIcon, PlusIcon } from '@/shared/ui/icons/AdminActionIcons';
import {
  adminCardSectionEditIconButtonClassName,
  adminWindowCardClassName,
  adminWindowCardStyle
} from '@/shared/ui/admin-table';
import {
  adminControlFocusTokenClasses,
  adminInputFocusTokenClasses
} from '@/shared/ui/theme/tokens';

const notesTextareaClassName =
  `block h-10 min-h-10 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] leading-5 text-slate-900 transition ${adminInputFocusTokenClasses}`;

export type AdminNotesCardProps = {
  headingId: string;
  testId: string;
  editActionId: string;
  isEditing: boolean;
  value: string;
  persistedValue: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function AdminNotesCard({
  headingId,
  testId,
  editActionId,
  isEditing,
  value,
  persistedValue,
  onChange,
  onToggle,
  disabled = false,
  autoFocus = false
}: AdminNotesCardProps) {
  return (
    <section
      className={`${adminWindowCardClassName} p-4`}
      style={adminWindowCardStyle}
      aria-labelledby={headingId}
      data-testid={testId}
    >
      <div className="flex min-h-7 items-center justify-between gap-4">
        <h2 id={headingId} className="text-base font-semibold text-slate-900">
          Opombe administratorja
        </h2>
        <button
          type="button"
          className={`${adminCardSectionEditIconButtonClassName} ${isEditing ? 'bg-[color:var(--hover-neutral)]' : ''}`}
          onClick={onToggle}
          aria-label={isEditing ? 'Končaj urejanje opombe' : 'Uredi interno opombo'}
          aria-pressed={isEditing}
          title={isEditing ? 'Končaj urejanje' : 'Uredi interno opombo'}
          disabled={disabled}
          data-admin-card-edit-action={editActionId}
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2.5">
        {isEditing ? (
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            placeholder="Vnesite interno opombo"
            aria-label="Opombe administratorja"
            className={notesTextareaClassName}
            autoFocus={autoFocus}
            disabled={disabled}
          />
        ) : persistedValue.trim() ? (
          <div
            className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3"
            title={persistedValue}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-slate-700">
              {persistedValue}
            </span>
          </div>
        ) : (
          <button
            type="button"
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-[12px] font-semibold text-[color:var(--blue-500)] transition hover:border-[color:var(--blue-300)] hover:bg-[color:var(--hover-neutral)] disabled:cursor-not-allowed disabled:opacity-50 ${adminControlFocusTokenClasses}`}
            onClick={onToggle}
            aria-label="Dodaj interno opombo"
            disabled={disabled}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current">
              <PlusIcon className="h-3 w-3" />
            </span>
            <span>Dodaj interno opombo</span>
          </button>
        )}
      </div>
    </section>
  );
}
