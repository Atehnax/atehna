import type { ReactNode } from 'react';
import {
  adminCompactIconFieldShellClassName,
  adminTopBarTitleTextClassName
} from '@/shared/ui/admin-controls/adminCompactFieldStyles';

const titleSlotWidthClassNames = {
  compact: 'sm:w-[200px]',
  wide: 'sm:w-[390px]'
} as const;

type AdminDetailTitleSlotProps = {
  editing: boolean;
  editor: ReactNode;
  editorAccessory?: ReactNode;
  editorPrefix?: ReactNode;
  icon: ReactNode;
  invalid?: boolean;
  testId: string;
  title: ReactNode;
  width: keyof typeof titleSlotWidthClassNames;
};

export function AdminDetailTitleSlot({
  editing,
  editor,
  editorAccessory,
  editorPrefix,
  icon,
  invalid = false,
  testId,
  title,
  width
}: AdminDetailTitleSlotProps) {
  return (
    <div
      className={`relative flex h-8 w-full min-w-0 items-center sm:flex-none ${titleSlotWidthClassNames[width]}`}
      data-testid={testId}
    >
      {editing ? (
        <div
          className={`${adminCompactIconFieldShellClassName} !mt-0 !h-8 w-full !pl-0 ${invalid ? '!border-rose-400' : ''}`}
        >
          {icon}
          <div className="flex min-w-0 flex-1 items-center">
            {editorPrefix ? (
              <span className={`shrink-0 text-slate-900 ${adminTopBarTitleTextClassName}`}>
                {editorPrefix}
              </span>
            ) : null}
            {editor}
            {editorAccessory}
          </div>
        </div>
      ) : (
        <h1 className="flex h-8 w-full min-w-0 items-center gap-2 pl-px text-[22px] font-semibold leading-none tracking-tight text-slate-950">
          {icon}
          <span className="truncate leading-tight">{title}</span>
        </h1>
      )}
    </div>
  );
}
