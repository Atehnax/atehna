'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import AdminRichTextEditor from '@/admin/components/AdminRichTextEditor';
import {
  AppearanceEditorNumberInput,
  AppearanceEditorToolbarButton,
  AppearanceEditorToolbarDivider,
  AppearanceEditorToolbarPopover,
  AppearanceEditorToolbarToneProvider
} from '@/admin/features/podoba/components/AppearanceEditorToolbarPrimitives';
import {
  EMAIL_TEMPLATE_BLOCK_IDS,
  EMAIL_TEMPLATE_SPACING_MAX_PX,
  EMAIL_TEMPLATE_SPACING_MIN_PX,
  resolveEmailTemplateSpacingPx,
  type EmailTemplateBlockId,
  type EmailTemplatePresentation
} from '@/shared/domain/emailTemplateLayout';
import type {
  OrderEmailSystemFieldId,
  OrderEmailSystemLine
} from '@/shared/domain/order/orderEmailSettings';
import { isOrderEmailSystemFieldId } from '@/shared/domain/order/orderEmailSettings';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';

const defaultSpacingDefaults = {
  sharedHeader: 18,
  templateContent: 0,
  audienceDetails: 20,
  customerDetails: 20,
  systemDetails: 20,
  items: 0,
  totals: 18,
  primaryAction: 24,
  sharedFooter: 28
} satisfies Record<EmailTemplateBlockId, number>;

const blockIds = new Set<string>(EMAIL_TEMPLATE_BLOCK_IDS);
const compactInputClassName =
  `h-8 w-full rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] text-white outline-none placeholder:text-white/35 ${adminControlFocusTokenClasses}`;
const compactTextareaClassName =
  `min-h-24 w-full resize-y rounded-lg border border-white/15 bg-white/10 px-2.5 py-2 text-[11px] leading-5 text-white outline-none placeholder:text-white/35 ${adminControlFocusTokenClasses}`;

export type EmailTemplateContextField = {
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
};

export type EmailTemplateContextSharedContent = {
  subjectPrefix: string;
  headerText: string;
  footerText: string;
  imageAttachment: {
    url: string;
    filename: string;
    size: number;
  } | null;
  disabled?: boolean;
  onSubjectPrefixChange: (value: string) => void;
  onHeaderTextChange: (value: string) => void;
  onFooterTextChange: (value: string) => void;
  onImageSelected: (file: File | null) => void;
  onImageRemove: () => void;
};

export type EmailTemplateContextSystemLines = {
  lines: readonly OrderEmailSystemLine[];
  available: ReadonlyArray<{
    field: OrderEmailSystemFieldId;
    label: string;
  }>;
  onChange: (lines: OrderEmailSystemLine[]) => void;
};

export type EmailTemplateContextPresentation = EmailTemplatePresentation & {
  systemLines?: OrderEmailSystemLine[];
};

export type EmailTemplateContextSpacingDefaults = Partial<
  Record<EmailTemplateBlockId, number>
>;

export type EmailTemplateContextToolbarProps = {
  idPrefix: string;
  selectedBlockId: string;
  selectedBlockLabel: string;
  disabled?: boolean;
  subject: EmailTemplateContextField;
  contentHtml: EmailTemplateContextField;
  variables: ReadonlyArray<{ name: string; value: string }>;
  presentation?: EmailTemplateContextPresentation;
  onPresentationChange: (
    presentation: EmailTemplateContextPresentation | undefined
  ) => void;
  spacingDefaults?: EmailTemplateContextSpacingDefaults;
  sharedContent: EmailTemplateContextSharedContent;
  systemLines?: EmailTemplateContextSystemLines;
  onClose: () => void;
};

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function systemFieldFromBlockId(blockId: string): OrderEmailSystemFieldId | null {
  if (!blockId.startsWith('systemLine:')) return null;
  const field = blockId.slice('systemLine:'.length);
  return isOrderEmailSystemFieldId(field) ? field : null;
}

function spacingBlockFromSelection(blockId: string): EmailTemplateBlockId | null {
  if (blockId.startsWith('systemLine:')) return null;
  return blockIds.has(blockId) ? blockId as EmailTemplateBlockId : null;
}

function cleanPresentation(
  presentation: EmailTemplateContextPresentation
): EmailTemplateContextPresentation | undefined {
  const blockSpacingPx = presentation.blockSpacingPx;
  const hasBlockSpacing = Boolean(
    blockSpacingPx && Object.keys(blockSpacingPx).length > 0
  );
  const cleaned: EmailTemplateContextPresentation = { ...presentation };
  if (presentation.verticalSpacingPx === undefined) {
    delete cleaned.verticalSpacingPx;
  }
  if (hasBlockSpacing) cleaned.blockSpacingPx = blockSpacingPx;
  else delete cleaned.blockSpacingPx;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export default function EmailTemplateContextToolbar({
  idPrefix,
  selectedBlockId,
  selectedBlockLabel,
  disabled = false,
  subject,
  contentHtml,
  variables,
  presentation,
  onPresentationChange,
  spacingDefaults,
  sharedContent,
  systemLines,
  onClose
}: EmailTemplateContextToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const panelTriggerRef = useRef<HTMLElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [panel, setPanel] = useState<
    'edit' | 'layout' | 'insert' | 'attachment' | null
  >(null);
  const selectedSystemField = systemFieldFromBlockId(selectedBlockId);
  const selectedSystemLineIndex = selectedSystemField && systemLines
    ? systemLines.lines.findIndex((line) => line.field === selectedSystemField)
    : -1;
  const selectedSystemLine = selectedSystemLineIndex >= 0 && systemLines
    ? systemLines.lines[selectedSystemLineIndex] ?? null
    : null;
  const spacingBlock = spacingBlockFromSelection(selectedBlockId);
  const resolvedSpacing = selectedSystemLine
    ? selectedSystemLine.spacingBeforePx ?? 0
    : spacingBlock
      ? resolveEmailTemplateSpacingPx(
          presentation,
          spacingBlock,
          spacingDefaults?.[spacingBlock] ?? defaultSpacingDefaults[spacingBlock]
        )
      : null;
  const selectionHasOwnSpacing = selectedSystemLine
    ? selectedSystemLine.spacingBeforePx !== undefined
    : Boolean(
        spacingBlock && presentation?.blockSpacingPx?.[spacingBlock] !== undefined
      );
  const hasSpacingTarget = Boolean(selectedSystemLine || spacingBlock);
  const spacingTargetLabel = selectedSystemLine ? 'vrstico' : 'elementom';
  const availableSystemFields = useMemo(() => {
    if (!systemLines) return [];
    const used = new Set(systemLines.lines.map((line) => line.field));
    return systemLines.available.filter((option) => !used.has(option.field));
  }, [systemLines]);

  useEffect(() => {
    setPanel(null);
  }, [selectedBlockId]);

  useEffect(() => {
    if (!panel) return;
    const transientSelector =
      '[data-admin-color-palette-portal], [data-appearance-editor-compact-select-portal], [role="dialog"]';
    const isTransient = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(transientSelector));
    const dismiss = (event: PointerEvent) => {
      if (
        !(event.target instanceof Node) ||
        toolbarRef.current?.contains(event.target) ||
        isTransient(event.target)
      ) {
        return;
      }
      setPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isTransient(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      setPanel(null);
      panelTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [panel]);

  const togglePanel = (next: Exclude<typeof panel, null>) => {
    panelTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setPanel((current) => current === next ? null : next);
  };

  const updateGlobalSpacing = (value: number) => {
    onPresentationChange({
      ...presentation,
      verticalSpacingPx: value
    });
  };

  const updateSelectionSpacing = (value: number) => {
    const spacing = Math.max(
      EMAIL_TEMPLATE_SPACING_MIN_PX,
      Math.min(EMAIL_TEMPLATE_SPACING_MAX_PX, Math.round(value))
    );
    if (selectedSystemLine && systemLines && selectedSystemLineIndex >= 0) {
      systemLines.onChange(
        systemLines.lines.map((line, index) =>
          index === selectedSystemLineIndex
            ? { ...line, spacingBeforePx: spacing }
            : { ...line }
        )
      );
      return;
    }
    if (!spacingBlock) return;
    onPresentationChange({
      ...presentation,
      blockSpacingPx: {
        ...presentation?.blockSpacingPx,
        [spacingBlock]: spacing
      }
    });
  };

  const resetSelectionSpacing = () => {
    if (selectedSystemLine && systemLines && selectedSystemLineIndex >= 0) {
      systemLines.onChange(
        systemLines.lines.map((line, index) => {
          if (index !== selectedSystemLineIndex) return { ...line };
          const { spacingBeforePx: _spacingBeforePx, ...withoutSpacing } = line;
          return withoutSpacing;
        })
      );
      return;
    }
    if (!spacingBlock || !presentation?.blockSpacingPx) return;
    const blockSpacingPx = { ...presentation.blockSpacingPx };
    delete blockSpacingPx[spacingBlock];
    onPresentationChange(cleanPresentation({
      ...presentation,
      blockSpacingPx
    }));
  };

  const updateSelectedSystemLine = (label: string) => {
    if (!systemLines || selectedSystemLineIndex < 0 || !selectedSystemLine) return;
    const next = systemLines.lines.map((line, index) =>
      index === selectedSystemLineIndex ? { ...line, label } : { ...line }
    );
    systemLines.onChange(next);
  };

  const moveSelectedSystemLine = (direction: -1 | 1) => {
    if (!systemLines || selectedSystemLineIndex < 0) return;
    const destination = selectedSystemLineIndex + direction;
    if (destination < 0 || destination >= systemLines.lines.length) return;
    const next = systemLines.lines.map((line) => ({ ...line }));
    const [line] = next.splice(selectedSystemLineIndex, 1);
    if (!line) return;
    next.splice(destination, 0, line);
    systemLines.onChange(next);
  };

  const removeSelectedSystemLine = () => {
    if (!systemLines || selectedSystemLineIndex < 0) return;
    systemLines.onChange(
      systemLines.lines
        .filter((_, index) => index !== selectedSystemLineIndex)
        .map((line) => ({ ...line }))
    );
    onClose();
  };

  const canEdit = [
    'subject',
    'templateContent',
    'sharedHeader',
    'sharedFooter'
  ].includes(selectedBlockId) || Boolean(selectedSystemLine);

  const editPanel = selectedBlockId === 'subject' ? (
    <div className="space-y-3" data-email-template-toolbar-panel="subject">
      <div>
        <label
          htmlFor={`${idPrefix}-subject-prefix`}
          className="mb-1 block text-[10px] font-semibold text-white/65"
        >
          Predpona · skupno za naročila in ponudbe
        </label>
        <input
          id={`${idPrefix}-subject-prefix`}
          className={compactInputClassName}
          value={sharedContent.subjectPrefix}
          maxLength={80}
          disabled={disabled || sharedContent.disabled}
          onChange={(event) =>
            sharedContent.onSubjectPrefixChange(event.target.value)
          }
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-subject`}
          className="mb-1 block text-[10px] font-semibold text-white/65"
        >
          Zadeva
        </label>
        <input
          id={`${idPrefix}-subject`}
          className={compactInputClassName}
          value={subject.value}
          maxLength={subject.maxLength}
          disabled={disabled}
          onChange={(event) => subject.onChange(event.target.value)}
        />
      </div>
    </div>
  ) : selectedBlockId === 'templateContent' ? (
    <div
      className="space-y-2"
      data-email-template-toolbar-panel="content"
    >
      <AdminRichTextEditor
        id={`${idPrefix}-content`}
        value={contentHtml.value}
        editable={!disabled}
        onChange={contentHtml.onChange}
        placeholder="Vnesite vsebino sporočila …"
        maxLength={contentHtml.maxLength}
        testId={`${idPrefix}-content-editor`}
        ariaLabel="Vsebina sporočila"
        allowImages={false}
        toolbarVariant="compact"
        heightClassName="h-[18rem] min-h-[16rem]"
      />
      <div className="flex flex-wrap gap-1" aria-label="Dovoljene spremenljivke">
        {variables.map((variable) => (
          <button
            key={variable.name}
            type="button"
            className="rounded-md border border-white/15 bg-white/10 px-1.5 py-1 text-[10px] leading-4 text-white/75 hover:bg-white/15"
            title={variable.value || undefined}
            onClick={() => {
              void navigator.clipboard?.writeText(`{{${variable.name}}}`);
            }}
          >
            <code>{`{{${variable.name}}}`}</code>
          </button>
        ))}
      </div>
    </div>
  ) : selectedBlockId === 'sharedHeader' || selectedBlockId === 'sharedFooter' ? (
    <div
      className="space-y-2"
      data-email-template-toolbar-panel={selectedBlockId}
    >
      <p className="text-[10px] leading-4 text-white/55">
        Skupno za naročila in ponudbe
      </p>
      <textarea
        className={compactTextareaClassName}
        aria-label={
          selectedBlockId === 'sharedHeader'
            ? 'Besedilo glave'
            : 'Dodatno besedilo v nogi'
        }
        value={
          selectedBlockId === 'sharedHeader'
            ? sharedContent.headerText
            : sharedContent.footerText
        }
        maxLength={1000}
        disabled={disabled || sharedContent.disabled}
        onChange={(event) => {
          if (selectedBlockId === 'sharedHeader') {
            sharedContent.onHeaderTextChange(event.target.value);
          } else {
            sharedContent.onFooterTextChange(event.target.value);
          }
        }}
      />
    </div>
  ) : selectedSystemLine ? (
    <div
      className="space-y-2"
      data-email-template-toolbar-panel="system-line"
    >
      <label
        htmlFor={`${idPrefix}-system-line-label`}
        className="block text-[10px] font-semibold text-white/65"
      >
        Oznaka dinamičnega podatka
      </label>
      <input
        id={`${idPrefix}-system-line-label`}
        className={compactInputClassName}
        value={selectedSystemLine.label}
        maxLength={80}
        disabled={disabled}
        onChange={(event) => updateSelectedSystemLine(event.target.value)}
      />
      <p className="text-[10px] leading-4 text-white/50">
        Vrednost se vedno varno prebere iz izbranega naročila.
      </p>
    </div>
  ) : null;

  const layoutPanel = (
    <div className="space-y-3" data-email-template-toolbar-panel="layout">
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-3">
        <div>
          <p className="text-[11px] font-semibold text-white">
            Splošni navpični razmik
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-white/50">
            Uporabi se povsod, kjer element nima lastne nastavitve.
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] overflow-hidden rounded-lg border border-white/15 bg-white/10">
          <AppearanceEditorNumberInput
            aria-label="Splošni navpični razmik"
            className="h-8 min-w-0 border-0 bg-transparent px-2 text-right text-[11px] text-white outline-none"
            value={presentation?.verticalSpacingPx ?? 16}
            min={EMAIL_TEMPLATE_SPACING_MIN_PX}
            max={EMAIL_TEMPLATE_SPACING_MAX_PX}
            disabled={disabled}
            onValueChange={updateGlobalSpacing}
          />
          <span className="inline-flex h-8 items-center border-l border-white/15 px-2 text-[10px] text-white/50">
            px
          </span>
        </div>
      </div>
      {presentation?.verticalSpacingPx !== undefined ? (
        <button
          type="button"
          className="text-[10px] font-semibold text-blue-200 hover:text-blue-100"
          disabled={disabled}
          onClick={() =>
            onPresentationChange(cleanPresentation({
              ...presentation,
              verticalSpacingPx: undefined
            }))
          }
        >
          Uporabi privzete razmike
        </button>
      ) : null}
    </div>
  );

  const insertPanel = (
    <div className="space-y-1.5" data-email-template-toolbar-panel="insert">
      {!sharedContent.headerText ? (
        <button
          type="button"
          className="flex h-8 w-full items-center rounded-lg px-2 text-left text-[11px] text-white/80 hover:bg-white/10"
          disabled={disabled || sharedContent.disabled}
          onClick={() => {
            sharedContent.onHeaderTextChange('Pozdravljeni,');
            setPanel(null);
          }}
        >
          Dodaj skupno glavo
        </button>
      ) : null}
      {!sharedContent.footerText ? (
        <button
          type="button"
          className="flex h-8 w-full items-center rounded-lg px-2 text-left text-[11px] text-white/80 hover:bg-white/10"
          disabled={disabled || sharedContent.disabled}
          onClick={() => {
            sharedContent.onFooterTextChange('Lep pozdrav,\nAtehna d.o.o.');
            setPanel(null);
          }}
        >
          Dodaj skupno nogo
        </button>
      ) : null}
      {availableSystemFields.map((option) => (
        <button
          key={option.field}
          type="button"
          className="flex h-8 w-full items-center rounded-lg px-2 text-left text-[11px] text-white/80 hover:bg-white/10"
          disabled={disabled}
          onClick={() => {
            systemLines?.onChange([
              ...systemLines.lines.map((line) => ({ ...line })),
              { field: option.field, label: option.label }
            ]);
            setPanel(null);
          }}
        >
          Dodaj {option.label}
        </button>
      ))}
      {sharedContent.headerText &&
      sharedContent.footerText &&
      availableSystemFields.length === 0 ? (
        <p className="px-2 py-1 text-[10px] leading-4 text-white/50">
          Vsi razpoložljivi elementi so že vključeni.
        </p>
      ) : null}
    </div>
  );

  const attachmentPanel = (
    <div
      className="space-y-3"
      data-email-template-toolbar-panel="attachment"
    >
      <input
        ref={imageInputRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label="Slikovna priponka"
        disabled={disabled || sharedContent.disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          sharedContent.onImageSelected(event.target.files?.[0] ?? null);
          event.currentTarget.value = '';
        }}
      />
      {sharedContent.imageAttachment ? (
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sharedContent.imageAttachment.url}
            alt=""
            className="h-12 w-12 rounded-lg border border-white/15 bg-white object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-white">
              {sharedContent.imageAttachment.filename}
            </p>
            <p className="text-[10px] text-white/50">
              {formatFileSize(sharedContent.imageAttachment.size)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] leading-4 text-white/55">
          Neobvezna skupna priponka za poslovna sporočila.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] font-semibold text-white hover:bg-white/15"
          disabled={disabled || sharedContent.disabled}
          onClick={() => imageInputRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {sharedContent.imageAttachment ? 'Zamenjaj' : 'Naloži'}
        </button>
        {sharedContent.imageAttachment ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
            disabled={disabled || sharedContent.disabled}
            onClick={sharedContent.onImageRemove}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Odstrani
          </button>
        ) : null}
      </div>
    </div>
  );

  const panelContent =
    panel === 'edit'
      ? editPanel
      : panel === 'layout'
        ? layoutPanel
        : panel === 'insert'
          ? insertPanel
          : panel === 'attachment'
            ? attachmentPanel
            : null;

  return (
    <div
      ref={toolbarRef}
      className="relative"
      data-email-template-context-toolbar={selectedBlockId}
    >
      <AppearanceEditorToolbarToneProvider tone="dark">
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto">
          <span
            className="mr-1 inline-flex h-8 max-w-44 shrink-0 items-center truncate rounded-lg bg-white/10 px-2.5 text-[11px] font-semibold text-white"
            title={selectedBlockLabel}
          >
            {selectedBlockLabel}
          </span>
          {hasSpacingTarget && resolvedSpacing !== null ? (
            <>
              <AppearanceEditorToolbarDivider />
              <AppearanceEditorToolbarButton
                label={`Zmanjšaj razmik pred ${spacingTargetLabel}`}
                disabled={disabled || resolvedSpacing <= EMAIL_TEMPLATE_SPACING_MIN_PX}
                onClick={() => updateSelectionSpacing(resolvedSpacing - 2)}
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </AppearanceEditorToolbarButton>
              <output
                className="inline-flex h-8 min-w-10 items-center justify-center px-1 text-[10px] font-semibold tabular-nums text-white/70"
                aria-label={`Razmik pred ${spacingTargetLabel}: ${resolvedSpacing} slikovnih pik`}
              >
                {resolvedSpacing}
              </output>
              <AppearanceEditorToolbarButton
                label={`Povečaj razmik pred ${spacingTargetLabel}`}
                disabled={disabled || resolvedSpacing >= EMAIL_TEMPLATE_SPACING_MAX_PX}
                onClick={() => updateSelectionSpacing(resolvedSpacing + 2)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </AppearanceEditorToolbarButton>
              {selectionHasOwnSpacing ? (
                <AppearanceEditorToolbarButton
                  label={`Ponastavi razmik pred ${spacingTargetLabel}`}
                  disabled={disabled}
                  onClick={resetSelectionSpacing}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </AppearanceEditorToolbarButton>
              ) : null}
            </>
          ) : null}
          <AppearanceEditorToolbarDivider />
          {canEdit ? (
            <AppearanceEditorToolbarButton
              label="Uredi izbrani element"
              popover
              active={panel === 'edit'}
              disabled={disabled}
              onClick={() => togglePanel('edit')}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </AppearanceEditorToolbarButton>
          ) : null}
          <AppearanceEditorToolbarButton
            label="Navpični razmiki"
            popover
            active={panel === 'layout'}
            disabled={disabled}
            onClick={() => togglePanel('layout')}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton
            label="Dodaj dinamični element"
            popover
            active={panel === 'insert'}
            disabled={disabled}
            onClick={() => togglePanel('insert')}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </AppearanceEditorToolbarButton>
          <AppearanceEditorToolbarButton
            label="Skupna slikovna priponka"
            popover
            active={panel === 'attachment'}
            disabled={disabled || sharedContent.disabled}
            onClick={() => togglePanel('attachment')}
          >
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          </AppearanceEditorToolbarButton>
          {selectedSystemLine ? (
            <>
              <AppearanceEditorToolbarDivider />
              <AppearanceEditorToolbarButton
                label="Premakni vrstico navzgor"
                disabled={disabled || selectedSystemLineIndex <= 0}
                onClick={() => moveSelectedSystemLine(-1)}
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label="Premakni vrstico navzdol"
                disabled={
                  disabled ||
                  !systemLines ||
                  selectedSystemLineIndex >= systemLines.lines.length - 1
                }
                onClick={() => moveSelectedSystemLine(1)}
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </AppearanceEditorToolbarButton>
              <AppearanceEditorToolbarButton
                label="Odstrani vrstico"
                danger
                disabled={disabled}
                onClick={removeSelectedSystemLine}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </AppearanceEditorToolbarButton>
            </>
          ) : null}
          <AppearanceEditorToolbarDivider />
          <AppearanceEditorToolbarButton label="Zapri" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </AppearanceEditorToolbarButton>
        </div>
      </AppearanceEditorToolbarToneProvider>
      {panelContent && panel ? (
        <AppearanceEditorToolbarPopover
          ariaLabel={
            panel === 'edit'
              ? `Uredi: ${selectedBlockLabel}`
              : panel === 'layout'
                ? 'Navpični razmiki sporočila'
                : panel === 'insert'
                  ? 'Dodaj dinamični element'
                  : 'Skupna slikovna priponka'
          }
          size={panel === 'edit' && selectedBlockId === 'templateContent'
            ? 'wide'
            : 'compact'}
        >
          {panelContent}
        </AppearanceEditorToolbarPopover>
      ) : null}
    </div>
  );
}
