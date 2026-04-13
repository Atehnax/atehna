'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Uppy from '@uppy/core';
import { UppyContextProvider, useDropzone } from '@uppy/react';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/badge';
import { AdminCheckbox } from '@/shared/ui/checkbox';
import { IconButton } from '@/shared/ui/icon-button';
import { PencilIcon, PlusIcon, SaveIcon, TrashCanIcon } from '@/shared/ui/icons/AdminActionIcons';
import { useToast } from '@/shared/ui/toast';
import { buttonTokenClasses } from '@/shared/ui/theme/tokens';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';
import EuiTabs from '@/shared/ui/eui-tabs';
import {
  buildFamiliesFromSeed,
  computeSalePrice,
  createFamily,
  createVariant,
  formatCurrency,
  toSlug,
  type ProductFamily,
  type SeedItemTuple,
  type Variant
} from '@/admin/features/artikli/lib/familyModel';
import AdminCategoryBreadcrumbPicker from '@/admin/features/artikli/components/AdminCategoryBreadcrumbPicker';
import OpisColorPopover from '@/admin/features/artikli/components/OpisColorPopover';
import Dialog from '@/shared/ui/dialog/dialog';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3e67d6] focus:ring-0';
const numberInputClass = '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const orderLikeEditableInputClassName = 'mt-0.5 h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-xs leading-5 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0';
const compactTableNumberInputClassName = `h-5 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] leading-4 text-slate-900 outline-none transition focus:border-[#3e67d6] focus:outline-none focus:ring-0 ${numberInputClass}`;
const compactSideInputWrapClassName = 'mt-0.5 flex h-[30px] items-center gap-2 rounded-md border border-slate-300 bg-white pl-[10px] pr-3';
const compactSideInputClassName = 'h-full w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none focus:ring-0';
const articleNameInputClassName = 'admin-item-name-input h-full w-full min-w-0 border-0 bg-transparent p-0 shadow-none outline-none transition focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none disabled:cursor-not-allowed';
const inlineSnippetClass = 'rounded bg-[#1982bf1a] px-1 py-0.5 font-mono text-[11px] text-[#1982bf]';
const mimeTypeToImageExtension: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'image/avif': 'AVIF',
  'image/bmp': 'BMP',
  'image/tiff': 'TIFF'
};

function inferImageExtensionLabel({ mimeType, fileName, url }: { mimeType?: string; fileName?: string; url?: string }) {
  const mimeLabel = mimeType ? mimeTypeToImageExtension[mimeType.toLowerCase()] : undefined;
  if (mimeLabel) return mimeLabel;
  const fromName = fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toUpperCase();
  if (fromName) return fromName;
  const fromUrl = url?.match(/\.([a-zA-Z0-9]+)(?:$|\?)/)?.[1]?.toUpperCase();
  if (fromUrl) return fromUrl;
  return 'IMG';
}

type EditorMode = 'create' | 'edit';
type CreateType = 'simple' | 'variants';
type MediaTab = 'slike' | 'video';
type VariantTag = 'novo' | 'akcija' | 'zadnji-kosi' | 'ni-na-zalogi';
type GeneratorDimension = 'length' | 'width' | 'thickness';
type GeneratorChip = { dimension: GeneratorDimension; values: number[] };
type VideoState = { source: 'upload' | 'youtube'; label: string; previewUrl: string };
type SideFieldIcon = 'name' | 'brand' | 'material' | 'shape' | 'color' | 'link' | 'document' | 'dimension' | 'price';
const MEDIA_SLOT_COUNT = 7;
const GALLERY_SMALL_SLOT_COUNT = 6;

function CalmDashedOutline({ className = '' }: { className?: string }) {
  const frameRef = useRef<SVGSVGElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [cornerRadius, setCornerRadius] = useState(8);

  useEffect(() => {
    const host = frameRef.current;
    if (!host?.parentElement) return;
    const parent = host.parentElement;
    const sync = () => {
      const rect = parent.getBoundingClientRect();
      setFrameSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
      const parentStyles = window.getComputedStyle(parent);
      const radius = Number.parseFloat(parentStyles.borderTopLeftRadius || '8');
      setCornerRadius(Number.isFinite(radius) ? radius : 8);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(0, frameSize.width);
  const height = Math.max(0, frameSize.height);
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const snapToDevicePixel = (value: number) => Math.round(value * devicePixelRatio) / devicePixelRatio;
  const snappedWidth = Math.max(1, snapToDevicePixel(width));
  const snappedHeight = Math.max(1, snapToDevicePixel(height));
  const svgOffsetX = (width - snappedWidth) / 2;
  const svgOffsetY = (height - snappedHeight) / 2;
  const strokeWidth = 1.125;
  const pathLength = 1000;
  const targetDashLength = 6;
  const targetGapLength = 10;
  const targetUnit = targetDashLength + targetGapLength;

  const snapToGrid = (value: number) => snapToDevicePixel(value);
  const inset = snapToGrid(strokeWidth / 2);
  const innerWidth = Math.max(0, snapToGrid(snappedWidth - inset * 2));
  const innerHeight = Math.max(0, snapToGrid(snappedHeight - inset * 2));
  const effectiveRadius = Math.max(0, snapToGrid(cornerRadius - inset));
  const perimeter = Math.max(
    1,
    2 * (innerWidth + innerHeight - effectiveRadius * 4) + (2 * Math.PI * effectiveRadius),
  );
  const cycleCount = Math.max(1, Math.round(perimeter / targetUnit));
  const normalizedCycle = pathLength / cycleCount;
  const dashRatio = targetDashLength / targetUnit;
  const normalizedDashLength = normalizedCycle * dashRatio;
  const normalizedGapLength = Math.max(1, normalizedCycle - normalizedDashLength);
  const dashOffset = -(normalizedCycle / 2);

  return (
    <svg
      ref={frameRef}
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ left: svgOffsetX, top: svgOffsetY }}
      width={snappedWidth}
      height={snappedHeight}
      viewBox={`0 0 ${snappedWidth} ${snappedHeight}`}
    >
      {width > 0 && height > 0 ? (
        <rect
          x={inset}
          y={inset}
          width={innerWidth}
          height={innerHeight}
          rx={effectiveRadius}
          ry={effectiveRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          pathLength={pathLength}
          strokeDasharray={`${normalizedDashLength} ${normalizedGapLength}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
      ) : null}
    </svg>
  );
}

function CloudUploadIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <path fill="currentColor" d="M17 40h30a11 11 0 0 0 1.5-21.9A17 17 0 0 0 16.2 13 12 12 0 0 0 17 40Z" />
      <path fill="#fff" d="M30 31v-9h-6l8-9 8 9h-6v9z" />
      <rect x="27.5" y="30.5" width="9" height="3" rx="1.5" fill="#fff" />
    </svg>
  );
}

function ImageUploadFrameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <rect x="9" y="8" width="46" height="32" rx="4" fill="#b9d3ea" />
      <path d="M9 28.5 20.5 20l7.5 5.6L42.5 14 55 25v15H9V28.5Z" fill="#74addb" />
      <circle cx="20.5" cy="13.5" r="4.5" fill="#eef5fb" />
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v2H7.5A1.5 1.5 0 0 0 6 7.5V10H4V6.5Z" fill="#74addb" />
      <path d="M60 6.5A2.5 2.5 0 0 0 57.5 4H54v2h2.5A1.5 1.5 0 0 1 58 7.5V10h2V6.5Z" fill="#74addb" />
      <path d="M4 41.5A2.5 2.5 0 0 0 6.5 44H10v-2H7.5A1.5 1.5 0 0 1 6 40.5V38H4v3.5Z" fill="#74addb" />
      <path d="M60 41.5A2.5 2.5 0 0 1 57.5 44H54v-2h2.5a1.5 1.5 0 0 0 1.5-1.5V38h2v3.5Z" fill="#74addb" />
    </svg>
  );
}

function VideoUploadFrameIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10v2H7.5A1.5 1.5 0 0 0 6 7.5V10H4V6.5Z" fill="currentColor" />
      <path d="M60 6.5A2.5 2.5 0 0 0 57.5 4H54v2h2.5A1.5 1.5 0 0 1 58 7.5V10h2V6.5Z" fill="currentColor" />
      <path d="M4 41.5A2.5 2.5 0 0 0 6.5 44H10v-2H7.5A1.5 1.5 0 0 1 6 40.5V38H4v3.5Z" fill="currentColor" />
      <path d="M60 41.5A2.5 2.5 0 0 1 57.5 44H54v-2h2.5a1.5 1.5 0 0 0 1.5-1.5V38h2v3.5Z" fill="currentColor" />
      <rect x="9" y="8" width="46" height="32" rx="4" fill="currentColor" opacity="0.9" />
      <path d="M27 18.2c0-1.7 1.8-2.8 3.3-2l11.5 6.4c1.6.9 1.6 3.1 0 4L30.3 33c-1.5.9-3.3-.2-3.3-2V18.2Z" fill="#f8fafc" />
    </svg>
  );
}

function UppyDropzoneField({
  uppy,
  disabled,
  onPrepareAddFiles,
  className = '',
  children
}: {
  uppy: Uppy;
  disabled: boolean;
  onPrepareAddFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <UppyContextProvider uppy={uppy}>
      <UppyDropzoneFieldInner disabled={disabled} onPrepareAddFiles={onPrepareAddFiles} className={className}>
        {children}
      </UppyDropzoneFieldInner>
    </UppyContextProvider>
  );
}

function UppyDropzoneFieldInner({
  disabled,
  onPrepareAddFiles,
  className = '',
  children
}: {
  disabled: boolean;
  onPrepareAddFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const [dragActive, setDragActive] = useState(false);
  const dropzone = useDropzone({
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDrop: (files) => {
      setDragActive(false);
      onPrepareAddFiles(files);
    },
    onFileInputChange: (files) => {
      onPrepareAddFiles(files);
    }
  });

  const rootProps = dropzone.getRootProps();
  const inputProps = dropzone.getInputProps();
  const interactionProps = disabled ? {} : rootProps;

  return (
    <div
      {...interactionProps}
      className={[
        'relative border-2 border-dashed transition',
        dragActive ? 'border-[#4f8bff] bg-[#edf3ff]' : 'border-[#9cb8ea] bg-[#f7f9fe]',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className
      ].join(' ')}
    >
      {disabled ? null : <input {...inputProps} className="hidden" />}
      {children}
    </div>
  );
}

function SideInputIcon({ icon, muted = false, className = '' }: { icon: SideFieldIcon; muted?: boolean; className?: string }) {
  const iconProps = {
    className: `h-[14px] w-[14px] shrink-0 ${muted ? 'text-slate-400' : 'text-slate-500'} ${className}`.trim(),
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    viewBox: '0 0 24 24'
  };

  if (icon === 'brand') {
    return (
      <svg {...iconProps}>
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    );
  }
  if (icon === 'name') {
    return (
      <svg {...iconProps}>
        <path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 .928 0L22 16" />
        <path d="M15.697 14h5.606" />
        <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16" />
        <path d="M3.304 13h6.392" />
      </svg>
    );
  }
  if (icon === 'material') {
    return (
      <svg {...iconProps}>
        <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
        <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
        <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
      </svg>
    );
  }
  if (icon === 'shape') {
    return (
      <svg {...iconProps}>
        <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <circle cx="17.5" cy="17.5" r="3.5" />
      </svg>
    );
  }
  if (icon === 'color') {
    return (
      <svg {...iconProps}>
        <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    );
  }
  if (icon === 'link') {
    return (
      <svg {...iconProps}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    );
  }
  if (icon === 'dimension') {
    return (
      <svg {...iconProps}>
        <path d="M10 15v-3" />
        <path d="M14 15v-3" />
        <path d="M18 15v-3" />
        <path d="M2 8V4" />
        <path d="M22 6H2" />
        <path d="M22 8V4" />
        <path d="M6 15v-3" />
        <rect x="2" y="12" width="20" height="8" rx="2" />
      </svg>
    );
  }
  if (icon === 'price') {
    return (
      <svg {...iconProps}>
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z" />
        <path d="M9.2 9.2h.01" />
        <path d="m14.5 9.5-5 5" />
        <path d="M14.7 14.8h.01" />
      </svg>
    );
  }
  return <svg {...iconProps}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 12h6M10 16h6" /></svg>;
}

function OpisRichTextEditor({
  value,
  editable,
  onChange
}: {
  value: string;
  editable: boolean;
  onChange: (next: string) => void;
}) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sizeTriggerRef = useRef<HTMLButtonElement>(null);
  const fontTriggerRef = useRef<HTMLButtonElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialContentRef = useRef(value || '<p></p>');
  const [textLength, setTextLength] = useState(0);
  const [openMenu, setOpenMenu] = useState<null | 'size' | 'font' | 'color'>(null);
  const [customColor, setCustomColor] = useState('#1e293b');
  const [fontSizeValue, setFontSizeValue] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [mediaDialogMode, setMediaDialogMode] = useState<'link' | 'image' | null>(null);
  const [mediaUrlDraft, setMediaUrlDraft] = useState('https://');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorHostRef.current) return;
    const FontSize = Extension.create({
      name: 'fontSize',
      addGlobalAttributes() {
        return [
          {
            types: ['textStyle'],
            attributes: {
              fontSize: {
                default: null,
                parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                renderHTML: (attributes: { fontSize?: string | null }) =>
                  attributes.fontSize
                    ? { style: `font-size: ${attributes.fontSize}` }
                    : {}
              }
            }
          }
        ];
      }
    });

    const editor = new Editor({
      element: editorHostRef.current,
      editable,
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        FontSize,
        Highlight.configure({ multicolor: true }),
        Color,
        FontFamily,
        TiptapLink.configure({ openOnClick: false, defaultProtocol: 'https' }),
        TiptapImage,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Opis artikla...' })
      ],
      content: initialContentRef.current,
      editorProps: {
        attributes: {
          class: `w-full bg-white px-5 py-4 text-[12px] font-['Inter',system-ui,sans-serif] text-slate-800 outline-none ${!editable ? 'cursor-default' : ''}`
        }
      },
      onUpdate: ({ editor: nextEditor }: { editor: Editor }) => {
        onChangeRef.current(nextEditor.getHTML());
        setTextLength(nextEditor.getText().length);
      }
    });

    setTextLength(editor.getText().length);
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = value || '<p></p>';
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
      setTextLength(editor.getText().length);
    }
  }, [value]);

  const getMenuRefs = useCallback((menu: 'size' | 'font' | 'color') => {
    if (menu === 'size') return { trigger: sizeTriggerRef.current, panel: sizeMenuRef.current };
    if (menu === 'font') return { trigger: fontTriggerRef.current, panel: fontMenuRef.current };
    return { trigger: colorTriggerRef.current, panel: null };
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!openMenu) return;
    const refs = getMenuRefs(openMenu);
    if (!refs.trigger) return;
    const rect = refs.trigger.getBoundingClientRect();
    const panelWidth = refs.panel?.offsetWidth ?? (openMenu === 'color' ? 228 : 90);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setMenuPosition({ top, left });
  }, [getMenuRefs, openMenu]);

  const positionMenuForTrigger = useCallback((menu: 'size' | 'font' | 'color', trigger: HTMLElement | null) => {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedWidth = menu === 'size' ? 100 : menu === 'font' ? 135 : 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - estimatedWidth - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setMenuPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    updateMenuPosition();
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const refs = getMenuRefs(openMenu);
      if (toolbarRef.current?.contains(target) || refs.trigger?.contains(target) || refs.panel?.contains(target)) return;
      setOpenMenu(null);
    };
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [getMenuRefs, openMenu, updateMenuPosition]);

  const run = (action: (editor: Editor) => void, options?: { focusEditor?: boolean }) => {
    const editor = editorRef.current;
    if (!editor || !editable) return;
    action(editor);
    if (options?.focusEditor ?? true) editor.commands.focus();
  };
  const applyFontSize = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    run((e) => e.chain().setMark('textStyle', { fontSize: `${parsed}px` }).run(), { focusEditor: false });
  };
  const applyColor = (nextColor: string) => {
    const normalized = nextColor.trim();
    if (!normalized) return;
    setCustomColor(normalized);
    run((e) => e.chain().setColor(normalized).run(), { focusEditor: false });
  };
  const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const applyListWithLineSplit = (ordered: boolean) => {
    run((editorInstance) => {
      const { from, to } = editorInstance.state.selection;
      const selected = editorInstance.state.doc.textBetween(from, to, '\n');
      const lines = selected.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
        const chain = editorInstance.chain().focus().deleteRange({ from, to }).insertContent(html);
        if (ordered) chain.toggleOrderedList().run();
        else chain.toggleBulletList().run();
        return;
      }
      if (ordered) editorInstance.chain().focus().toggleOrderedList().run();
      else editorInstance.chain().focus().toggleBulletList().run();
    });
  };
  const submitMediaUrl = () => {
    const normalized = mediaUrlDraft.trim();
    if (!normalized) return;
    if (mediaDialogMode === 'link') run((e) => e.chain().focus().setLink({ href: normalized }).run());
    if (mediaDialogMode === 'image') run((e) => e.chain().focus().setImage({ src: normalized }).run());
    setMediaDialogMode(null);
    setMediaUrlDraft('https://');
  };
  const preventToolbarFocusLoss = (event: { preventDefault: () => void }) => event.preventDefault();
  const toolbarButtonClass = 'rounded p-1.5 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const toolbarIconClass = 'h-4 w-4';
  const toolbarIconItalicClass = 'h-[14px] w-[14px]';
  const toolbarIconTextSizeClass = 'h-[17.6px] w-[17.6px]';
  const toolbarIconLargeClass = 'h-[18px] w-[18px]';
  const toolbarIconAlignClass = 'h-4 w-4';
  const toolbarIconSmallClass = 'h-[13.6px] w-[13.6px]';
  const toolbarIconTinyClass = 'h-3.5 w-3.5';
  const toolbarIconHighlightClass = 'h-3.5 w-3.5';
  const divider = <span className="mx-1 h-6 w-px bg-slate-300" aria-hidden />;
  const fontFamilyOptions = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'system-ui', value: 'system-ui, sans-serif' }
  ] as const;

  return (
    <div className={`relative flex h-[150px] min-h-[130px] resize-y flex-col overflow-hidden rounded-lg border border-slate-300 ${editable ? 'bg-white' : 'bg-[color:var(--ui-neutral-bg)]'}`}>
      <div ref={toolbarRef} className="flex flex-nowrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button type="button" title="Krepko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleBold().run())} aria-label="Bold"><span className="inline-block w-4 text-center text-base font-bold leading-none">B</span></button>
        <button type="button" title="Ležeče" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleItalic().run())} aria-label="Italic"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconItalicClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
        <button type="button" title="Podčrtano" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleUnderline().run())} aria-label="Underline"><span className="inline-block w-4 text-center text-base underline leading-none">U</span></button>
        {divider}
        <button type="button" title="Točkovni seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(false)} aria-label="Bullet list"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3 5.75A.75.75 0 1 1 4.5 5.75.75.75 0 0 1 3 5.75Zm0 4.25A.75.75 0 1 1 4.5 10 .75.75 0 0 1 3 10Zm0 4.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7 5h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Z" /></svg></button>
        <button type="button" title="Oštevilčen seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(true)} aria-label="Ordered list"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 5h1v4h-1V7.3l-.7.3L2.5 6.8 3.5 6.3V5Zm3.5 0h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Zm-3.5-.15a1.9 1.9 0 0 1 1.9 1.9c0 .42-.13.79-.43 1.12-.23.26-.56.48-1 .63H5.5V18H2.5v-1.08l1.32-1.1c.2-.17.34-.3.41-.4a.66.66 0 0 0 .12-.39.63.63 0 0 0-.2-.48.81.81 0 0 0-.54-.17c-.34 0-.67.11-.99.33L2 13.9a2.4 2.4 0 0 1 1.5-.55Z" /></svg></button>
        {divider}
        <div className="relative">
          <button ref={sizeTriggerRef} type="button" title="Velikost besedila" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'size' ? null : 'size'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Text size"><svg className={toolbarIconTextSizeClass} viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M21,9.08A1.13,1.13,0,0,0,19.86,8H4.62a1.1,1.1,0,1,0,0,2.19H11V27a1.09,1.09,0,0,0,2.17,0V10.19h6.69A1.14,1.14,0,0,0,21,9.08Z" /><path d="M30.67,15H21.15a1.1,1.1,0,1,0,0,2.19H25V26.5a1.09,1.09,0,0,0,2.17,0V17.23h3.54a1.1,1.1,0,1,0,0-2.19Z" /></svg></button>
          {openMenu === 'size' && editable && menuPosition ? createPortal(
            <MenuPanel ref={sizeMenuRef} className="fixed z-[90] w-[100px] p-2 shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
              <div className="grid grid-cols-[1.25fr_1fr] items-center overflow-hidden rounded-md border border-slate-300">
                <input
                  type="number"
                  min={1}
                  className={`h-8 w-full border-0 px-2 text-xs text-slate-700 outline-none focus:ring-0 ${numberInputClass}`}
                  value={fontSizeValue}
                  onChange={(event) => {
                    setFontSizeValue(event.target.value);
                    applyFontSize(event.target.value);
                  }}
                  placeholder="16"
                />
                <span className="inline-flex h-8 items-center justify-center border-l border-slate-300 bg-slate-50 text-xs text-slate-500">px</span>
              </div>
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button ref={fontTriggerRef} type="button" title="Pisava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'font' ? null : 'font'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Font family"><svg className={toolbarIconLargeClass} viewBox="0 0 20 20" fill="currentColor"><path d="m11.3 4.5 4.2 11h-2.1l-.8-2.4H8.2l-.8 2.4H5.3l4.2-11h1.8Zm.7 6.8-1.6-4.7-1.6 4.7H12Z" /></svg></button>
          {openMenu === 'font' && editable && menuPosition ? createPortal(
            <MenuPanel ref={fontMenuRef} className="fixed z-[90] w-[135px] shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
              {fontFamilyOptions.map((font) => (
                <MenuItem key={font.value} className="h-8 text-[12px]" onClick={() => { run((e) => e.chain().focus().setFontFamily(font.value).run()); setOpenMenu(null); }}>
                  <span className="text-[12px]" style={{ fontFamily: font.value }}>{font.label}</span>
                </MenuItem>
              ))}
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button
            ref={colorTriggerRef}
            type="button"
            title="Barva besedila"
            className={toolbarButtonClass}
            disabled={!editable}
            onMouseDown={preventToolbarFocusLoss}
            onClick={(event) => {
              event.stopPropagation();
              const next = openMenu === 'color' ? null : 'color';
              if (next) positionMenuForTrigger(next, event.currentTarget);
              setOpenMenu(next);
            }}
            aria-label="Text color"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconTinyClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 10 3 3"/><path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/><path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/></svg>
          </button>
          <OpisColorPopover open={openMenu === 'color' && editable} anchorRef={colorTriggerRef} color={customColor} onChange={applyColor} onClose={() => setOpenMenu(null)} />
        </div>
        <button type="button" title="Označi besedilo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().toggleHighlight({ color: '#fde68a' }).run())} aria-label="Highlight"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconHighlightClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg></button>
        <button type="button" title="Vodoravna črta" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setHorizontalRule().run())} aria-label="Horizontal rule"><svg className={toolbarIconClass} viewBox="0 0 20 20" fill="currentColor"><path d="M3 9.25h14v1.5H3v-1.5Z" /></svg></button>
        {divider}
        <button type="button" title="Povezava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => {
          if (e.isActive('link')) {
            e.chain().focus().unsetLink().run();
            return;
          }
          setMediaDialogMode('link');
          setMediaUrlDraft('https://');
        })} aria-label="Link"><svg className={toolbarIconSmallClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></button>
        <button type="button" title="Slika" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => { setMediaDialogMode('image'); setMediaUrlDraft('https://'); }} aria-label="Image"><svg className={toolbarIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
        {divider}
        <button type="button" title="Poravnaj levo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('left').run())} aria-label="Align left"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/></svg></button>
        <button type="button" title="Poravnaj na sredino" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('center').run())} aria-label="Align center"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/></svg></button>
        <button type="button" title="Poravnaj desno" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('right').run())} aria-label="Align right"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/></svg></button>
        <button type="button" title="Poravnaj obojestransko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((e) => e.chain().focus().setTextAlign('justify').run())} aria-label="Align justify"><svg xmlns="http://www.w3.org/2000/svg" className={toolbarIconAlignClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></svg></button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={editorHostRef}
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-hidden [&_.ProseMirror]:min-h-[112px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror]:prose [&_.ProseMirror]:max-w-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h3]:text-base [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:text-blue-600 [&_.ProseMirror_a]:underline ${editable ? '[&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:prose-slate' : 'cursor-not-allowed [&_.ProseMirror]:bg-[color:var(--ui-neutral-bg)] [&_.ProseMirror]:text-slate-500 [&_.ProseMirror]:prose-slate'}`}
        />
        <div className={`pointer-events-none ml-auto px-4 pb-2 text-xs ${editable ? 'text-slate-400' : 'text-slate-500'}`}>{textLength} / 5000</div>
      </div>
      <Dialog
        open={mediaDialogMode !== null}
        onOpenChange={(open) => {
          if (open) return;
          setMediaDialogMode(null);
          setMediaUrlDraft('https://');
        }}
        title={mediaDialogMode === 'link' ? 'Dodaj povezavo' : 'Dodaj sliko'}
        isDismissable
        footer={(
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="default" size="toolbar" onClick={() => setMediaDialogMode(null)}>Prekliči</Button>
            <Button type="button" variant="primary" size="toolbar" onClick={submitMediaUrl}>Potrdi</Button>
          </div>
        )}
      >
        <div className="mt-2 space-y-1">
          <label className="text-xs text-slate-600">{mediaDialogMode === 'link' ? 'URL povezave' : 'URL slike'}</label>
          <input className={inputClass} value={mediaUrlDraft} onChange={(event) => setMediaUrlDraft(event.target.value)} placeholder="https://" />
        </div>
      </Dialog>
    </div>
  );
}

function ActiveStateChip({
  active,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom'
}: {
  active: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = active ? 'Aktiven' : 'Neaktiven';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(130, menuRef.current?.offsetWidth ?? 130);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant={active ? 'success' : 'neutral'} className={chipClassName}>{label}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[1000] min-w-[130px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Aktiven</MenuItem>
                <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Neaktiven</MenuItem>
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function NeutralDropdownChip({
  value,
  editable,
  options,
  onChange,
  chipClassName,
  placeholderLabel
}: {
  value: string;
  editable: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  chipClassName?: string;
  placeholderLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const displayedLabel = selectedOption?.label ?? placeholderLabel ?? '';

  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant="neutral" className={`min-w-[124px] ${chipClassName ?? ''}`}>{displayedLabel}</Chip>
        </span>
      </button>

      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[150px]">
          <MenuPanel>
            {options.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

function TagStateChip({
  value,
  editable,
  onChange,
  chipClassName,
  menuPlacement = 'bottom'
}: {
  value: VariantTag;
  editable: boolean;
  onChange: (next: VariantTag) => void;
  chipClassName?: string;
  menuPlacement?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label =
    value === 'novo'
      ? 'Novo'
      : value === 'akcija'
        ? 'V akciji'
        : value === 'ni-na-zalogi'
          ? 'Ni na zalogi'
          : 'Zadnji kosi';
  const variant = value === 'novo' ? 'info' : value === 'akcija' ? 'danger' : value === 'ni-na-zalogi' ? 'neutral' : 'purple';
  const emphasisClassName = value === 'akcija' ? '!border-rose-200 !bg-rose-50 !text-rose-700' : '';

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(130, menuRef.current?.offsetWidth ?? 130);
    const left = Math.min(Math.max(8, triggerRect.left), window.innerWidth - menuWidth - 8);
    const top = menuPlacement === 'top' ? triggerRect.top - 6 : triggerRect.bottom + 6;
    setMenuPosition({ top, left });
  }, [menuPlacement]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
        aria-haspopup={editable ? 'menu' : undefined}
        aria-expanded={editable ? isOpen : undefined}
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <span className="block">
          <Chip variant={variant} className={`${chipClassName ?? ''} ${emphasisClassName}`.trim()}>{label}</Chip>
        </span>
      </button>

      {editable && isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className={`fixed z-[1000] min-w-[130px] ${menuPlacement === 'top' ? '-translate-y-full' : ''}`}
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <MenuPanel>
                <MenuItem onClick={() => { onChange('novo'); setIsOpen(false); }}>Novo</MenuItem>
                <MenuItem onClick={() => { onChange('akcija'); setIsOpen(false); }}>V akciji</MenuItem>
                <MenuItem onClick={() => { onChange('zadnji-kosi'); setIsOpen(false); }}>Zadnji kosi</MenuItem>
                <MenuItem onClick={() => { onChange('ni-na-zalogi'); setIsOpen(false); }}>Ni na zalogi</MenuItem>
              </MenuPanel>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function VisibilityChip({
  visible,
  editable,
  onChange
}: {
  visible: boolean;
  editable: boolean;
  onChange: (next: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!editable) return;
          setIsOpen((current) => !current);
        }}
        className="relative block rounded-full focus:outline-none"
      >
        {editable ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">▾</span> : null}
        <Chip variant={visible ? 'success' : 'warning'}>{visible ? 'Prikaži' : 'Skrij'}</Chip>
      </button>
      {editable && isOpen ? (
        <div role="menu" className="absolute left-0 top-8 z-30 min-w-[120px]">
          <MenuPanel>
            <MenuItem onClick={() => { onChange(true); setIsOpen(false); }}>Prikaži</MenuItem>
            <MenuItem onClick={() => { onChange(false); setIsOpen(false); }}>Skrij</MenuItem>
          </MenuPanel>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminItemEditorPage({
  seedItems,
  articleId,
  mode,
  createType = 'simple'
}: {
  seedItems: SeedItemTuple[];
  articleId?: string;
  mode: EditorMode;
  createType?: CreateType;
}) {
  const { toast } = useToast();
  const families = useMemo(() => buildFamiliesFromSeed(seedItems), [seedItems]);
  const existing = mode === 'edit' ? families.find((family) => family.id === articleId) ?? null : null;
  const categoryPathsFromSeed = useMemo(
    () => Array.from(new Set(seedItems.map(([, , , categoryPath]) => categoryPath).filter((categoryPath) => categoryPath.trim().length > 0))),
    [seedItems]
  );
  const [categoryPaths, setCategoryPaths] = useState<string[]>(categoryPathsFromSeed);

  const [draft, setDraft] = useState<ProductFamily>(() => {
    if (existing) return structuredClone(existing);
    return createFamily({
      variants: createType === 'variants' ? [createVariant()] : [createVariant({ label: 'Osnovni artikel' })],
      active: true
    });
  });
  const [variantSelections, setVariantSelections] = useState<Set<string>>(new Set());
  const [generatorInput, setGeneratorInput] = useState('');
  const [generatorPriceInput, setGeneratorPriceInput] = useState('');
  const [generatorChips, setGeneratorChips] = useState<GeneratorChip[]>([]);
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [sideSettings, setSideSettings] = useState({
    brand: '',
    material: '',
    surface: '',
    color: '',
    thicknessTolerance: '',
    moq: 1,
    weightPerUnit: '0',
    palletCount: '',
    dimensions: { width: '', depth: '', height: '' },
    trackInventory: true,
    currentStock: 0,
    minStock: 0,
    warehouseLocation: '',
    basePriceNoVat: '',
    priceRounding: '0.01',
    showOldPrice: true,
    showGallery: true,
    autoSquareCrop: true,
    imageFocus: 'center',
    galleryMode: 'grid' as 'grid' | 'slider' | 'list',
    imageAltText: '',
    videoUrl: ''
  });
  const [documents, setDocuments] = useState<Array<{ name: string; size: string }>>([]);
  const [editorMode, setEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [tableEditorMode, setTableEditorMode] = useState<'read' | 'edit'>(mode === 'create' ? 'edit' : 'read');
  const [articleType, setArticleType] = useState<'unit' | 'sheet' | 'bulk' | 'linear' | ''>('');
  const [mediaTab, setMediaTab] = useState<MediaTab>('slike');
  const [mediaMode, setMediaMode] = useState<'read' | 'edit'>('read');
  const [mediaImagesSaved, setMediaImagesSaved] = useState<string[]>(draft.images);
  const [mediaImagesDraft, setMediaImagesDraft] = useState<string[]>(draft.images);
  const [selectedImageIndexes, setSelectedImageIndexes] = useState<Set<number>>(new Set());
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [draggedVariantId, setDraggedVariantId] = useState<string | null>(null);
  const [draggedVariantImageSlot, setDraggedVariantImageSlot] = useState<number | null>(null);
  const [imageMeta, setImageMeta] = useState<Record<string, { width: number; height: number; type: string }>>({});
  const localBlobUrlsRef = useRef<Set<string>>(new Set());
  const imageTypeHintsRef = useRef<Record<string, string>>({});
  const suppressImageClickAfterDragRef = useRef(false);
  const uppyRef = useRef<Uppy | null>(null);
  const uploadPlanRef = useRef<{ startSlot: number; nextOffset: number; maxFiles: number }>({ startSlot: 0, nextOffset: 0, maxFiles: 1 });
  const mediaUploadInputRef = useRef<HTMLInputElement>(null);
  const mediaUploadContextRef = useRef<{ slotIndex: number; multiple: boolean }>({ slotIndex: 0, multiple: true });
  const updateImageAtSlotRef = useRef<(slotIndex: number, imageUrl: string) => void>(() => {});
  const [youtubeInput, setYoutubeInput] = useState('');
  const [videoDraft, setVideoDraft] = useState<VideoState | null>(null);
  const [videoDragActive, setVideoDragActive] = useState(false);
  const [videoMoveMode, setVideoMoveMode] = useState(false);
  const [videoAssignedVariantId, setVideoAssignedVariantId] = useState<string | null>(null);
  const [variantTags, setVariantTags] = useState<Record<string, VariantTag>>({});
  const [editingImageSlot, setEditingImageSlot] = useState<number | null>(null);
  const [imageSettings, setImageSettings] = useState<Record<number, { altText: string; focusX: number; focusY: number }>>({});
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string[]>(() =>
    (draft.category || '')
      .split('/')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  useEffect(() => {
    setDraft((current) => ({ ...current, category: selectedCategoryPath.join(' / ') }));
  }, [selectedCategoryPath]);

  useEffect(() => {
    if (!videoDraft) {
      if (videoAssignedVariantId !== null) setVideoAssignedVariantId(null);
      if (videoMoveMode) setVideoMoveMode(false);
      return;
    }
    if (!draft.variants.length) {
      if (videoAssignedVariantId !== null) setVideoAssignedVariantId(null);
      return;
    }
    const hasAssignedVariant = videoAssignedVariantId
      ? draft.variants.some((variant) => variant.id === videoAssignedVariantId)
      : false;
    if (!hasAssignedVariant) {
      setVideoAssignedVariantId(draft.variants[0].id);
    }
  }, [draft.variants, videoAssignedVariantId, videoDraft, videoMoveMode]);

  useEffect(() => {
    let cancelled = false;

    const hydrateCategoryTree = async () => {
      try {
        const response = await fetch('/api/admin/categories/paths', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { paths?: string[] };
        const apiPaths = Array.isArray(payload.paths) ? payload.paths : [];
        const mergedPaths = Array.from(new Set([...categoryPathsFromSeed, ...apiPaths]));
        if (!cancelled) setCategoryPaths(mergedPaths);
      } catch {
        if (!cancelled) setCategoryPaths(categoryPathsFromSeed);
      }
    };

    void hydrateCategoryTree();
    return () => {
      cancelled = true;
    };
  }, [categoryPathsFromSeed]);

  const selectCategoryPath = (path: string[]) => {
    setSelectedCategoryPath(path);
  };

  useEffect(() => {
    if (articleType !== 'unit') return;
    const parsedPrice = Number(generatorPriceInput.replace(',', '.'));
    if (!Number.isFinite(parsedPrice)) return;
    setDraft((current) => {
      const nextVariants = current.variants.map((variant) => (variant.price === parsedPrice ? variant : { ...variant, price: parsedPrice }));
      const changed = nextVariants.some((variant, index) => variant !== current.variants[index]);
      return changed ? { ...current, variants: nextVariants } : current;
    });
  }, [articleType, generatorPriceInput]);

  const isEditable = editorMode === 'edit';
  const isTableEditable = tableEditorMode === 'edit';
  const isMediaEditable = mediaMode === 'edit';
  const isBulkMaterial = articleType === 'bulk';
  const isLinearMaterial = articleType === 'linear';
  const isToleranceLocked = articleType === 'unit';
  const isDimensionLockActive = isBulkMaterial;
  const isThicknessLockActive = isBulkMaterial || isLinearMaterial;
  const isGeneratorLocked = !isTableEditable || isDimensionLockActive;
  const generatorUnitLabel = articleType === 'sheet' ? 'na m²' : articleType === 'bulk' ? 'na kg' : articleType === 'unit' ? 'na kos' : articleType === 'linear' ? 'na m' : 'na enoto';
  const hasSelectedVariants = variantSelections.size > 0;
  const allVariantsSelected = draft.variants.length > 0 && draft.variants.every((variant) => variantSelections.has(variant.id));
  const generatorDimensionLabels: Record<GeneratorDimension, string> = {
    length: 'Dolžina',
    width: 'Širina/fi',
    thickness: 'Debelina'
  };
  const generatorByDimension = useMemo(() => {
    const map = new Map<GeneratorDimension, number[]>();
    generatorChips.forEach((chip) => {
      map.set(chip.dimension, chip.values);
    });
    return map;
  }, [generatorChips]);
  const combinationCount = useMemo(() => {
    const activeDimensions = (['length', 'width', 'thickness'] as const)
      .map((dimension) => generatorByDimension.get(dimension) ?? [])
      .filter((values) => values.length > 0);
    if (activeDimensions.length < 2) return 0;
    return activeDimensions.reduce((total, values) => total * values.length, 1);
  }, [generatorByDimension]);

  useEffect(() => {
    if (!isLinearMaterial) return;
    setGeneratorChips((current) => current.filter((chip) => chip.dimension !== 'thickness'));
    if (generatorInput.trim()) {
      const normalizedPrefix = generatorInput
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .split(':')[0]
        ?.trim();
      if (normalizedPrefix === 'debelina' || normalizedPrefix === 'v' || normalizedPrefix === 'h') {
        setGeneratorInput('');
      }
    }
  }, [isLinearMaterial, generatorInput]);

  const save = (asDraft = false) => {
    if (!draft.name.trim()) {
      toast.error('Naziv je obvezen.');
      return;
    }
    if (!draft.category.trim()) {
      toast.error('Kategorija je obvezna.');
      return;
    }
    toast.success(asDraft ? 'Osnutek shranjen (lokalno).' : 'Artikel shranjen (lokalno).');
  };
  const deleteItem = () => {
    const shouldDelete = window.confirm('Ali želite odstraniti artikel iz urejanja?');
    if (!shouldDelete) return;
    toast.success('Artikel je označen za brisanje (lokalni prikaz).');
  };

  const generateVariants = () => {
    const widths = generatorByDimension.get('width') ?? [];
    const lengths = generatorByDimension.get('length') ?? [];
    const thicknesses = generatorByDimension.get('thickness') ?? [];
    const shouldUseThickness = !isLinearMaterial;
    const thicknessValues = shouldUseThickness ? thicknesses : [0];

    if (widths.length === 0 || lengths.length === 0 || (shouldUseThickness && thicknesses.length === 0)) {
      toast.error(shouldUseThickness ? 'Najprej dodajte Dolžino, Širino in Debelino.' : 'Najprej dodajte Dolžino in Širino/fi.');
      return;
    }

    const generated: Variant[] = [];
    const parsedGeneratorPrice = Number(generatorPriceInput.replace(',', '.'));
    const nextPrice = Number.isFinite(parsedGeneratorPrice) ? parsedGeneratorPrice : 0;
    widths.forEach((width) => lengths.forEach((length) => thicknessValues.forEach((thickness) => {
      generated.push(createVariant({
        label: shouldUseThickness ? `${width} × ${length} × ${thickness} mm` : `${width} × ${length} mm`,
        width,
        length,
        thickness,
        sku: shouldUseThickness
          ? `${toSlug(draft.name || 'artikel').toUpperCase()}-${width}${length}${thickness}`
          : `${toSlug(draft.name || 'artikel').toUpperCase()}-${width}${length}`,
        price: nextPrice,
        discountPct: draft.defaultDiscountPct,
        sort: generated.length + 1
      }));
    })));

    setDraft((current) => ({ ...current, variants: generated }));
    setVariantSelections(new Set());
  };

  const parseGeneratorEntry = (value: string): { dimension: GeneratorDimension; values: number[] } | { error: string } => {
    const normalized = value.trim();
    if (!normalized) return { error: 'Vnos ne sme biti prazen.' };
    const match = normalized.match(/^(dolzina|dolžina|sirina(?:\/fi)?|širina(?:\/fi)?|debelina|fi|d|s|š|v|h)\s*:?\s*(.+)$/i);
    if (!match) return { error: 'Uporabite Dolžina/Širina/fi/Debelina + vrednosti.' };
    const prefix = match[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const rawValues = (match[2] ?? '').trim().replace(/:/g, ',');
    if (!rawValues) return { error: 'Dodajte vsaj eno številčno vrednost.' };

    const dimension: GeneratorDimension = (prefix.startsWith('dol') || prefix === 'd')
      ? 'length'
      : (prefix.startsWith('sir') || prefix.startsWith('fi') || prefix === 's')
        ? 'width'
        : (prefix.startsWith('deb') || prefix === 'v' || prefix === 'h')
          ? 'thickness'
          : 'thickness';
    const parts = rawValues.split(',').map((entry) => entry.trim()).filter(Boolean);
    if (parts.length === 0) return { error: 'Dodajte vsaj eno številčno vrednost.' };
    if (parts.length > 5) return { error: `${generatorDimensionLabels[dimension]} podpira največ 5 vrednosti.` };
    if (isLinearMaterial && dimension === 'thickness') {
      return { error: 'Za dolžinski material Debelina ni dovoljena.' };
    }

    const parsedValues: number[] = [];
    const duplicateGuard = new Set<number>();
    for (const part of parts) {
      const parsed = Number(part.replace(',', '.'));
      if (!Number.isFinite(parsed)) return { error: 'Vse vrednosti morajo biti številke.' };
      if (duplicateGuard.has(parsed)) return { error: 'Podvojene vrednosti v isti dimenziji niso dovoljene.' };
      duplicateGuard.add(parsed);
      parsedValues.push(parsed);
    }

    return { dimension, values: parsedValues };
  };

  const submitGeneratorEntry = () => {
    const parsed = parseGeneratorEntry(generatorInput);
    if ('error' in parsed) {
      setGeneratorError(parsed.error);
      return;
    }
    setGeneratorError(null);
    setGeneratorChips((current) => {
      const next = current.filter((chip) => chip.dimension !== parsed.dimension);
      return [...next, parsed];
    });
    setGeneratorInput('');
  };

  const resolveYoutubeEmbedUrl = (rawUrl: string) => {
    const value = rawUrl.trim();
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (!normalized.includes('youtube.com') && !normalized.includes('youtu.be')) return null;
    try {
      const parsed = new URL(value);
      if (parsed.hostname.includes('youtu.be')) {
        const videoId = parsed.pathname.replace('/', '').trim();
        if (!videoId) return null;
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (!parsed.hostname.includes('youtube.com')) return null;
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v');
        if (!videoId) return null;
        return `https://www.youtube.com/embed/${videoId}`;
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return `${parsed.origin}${parsed.pathname}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const submitYoutubeVideo = (rawUrl: string, options: { showError?: boolean } = {}) => {
    const value = rawUrl.trim();
    if (!value) return false;
    const previewUrl = resolveYoutubeEmbedUrl(value);
    if (!previewUrl) {
      if (options.showError) toast.error('Vnesite veljavno YouTube povezavo.');
      return false;
    }
    setVideoDraft({ source: 'youtube', label: value, previewUrl });
    setYoutubeInput('');
    setVideoMoveMode(false);
    return true;
  };

  const saveVideoEntries = () => {
    setMediaImagesSaved(mediaImagesDraft);
    setDraft((current) => ({ ...current, images: mediaImagesDraft }));
    toast.success('Video spremembe shranjene lokalno.');
  };

  const handleVideoFileSelect = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Izberite veljavno video datoteko.');
      return;
    }
    const maxBytes = 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Video je prevelik. Dovoljena velikost je največ 100 MB.');
      return;
    }
    setVideoDraft({ source: 'upload', label: file.name, previewUrl: URL.createObjectURL(file) });
    setVideoMoveMode(false);
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    setDraft((current) => {
      const next = [...current.variants];
      next[index] = { ...next[index], ...updates };
      return { ...current, variants: next };
    });
  };

  const deleteSelectedVariants = () => {
    if (!isTableEditable || !hasSelectedVariants) return;
    setDraft((current) => {
      const remainingVariants = current.variants.filter((variant) => !variantSelections.has(variant.id));
      return {
        ...current,
        variants: remainingVariants.map((variant, index) => ({
          ...variant,
          sort: index + 1
        }))
      };
    });
    setVariantSelections(new Set());
  };

  const setVariantTag = (variantId: string, tag: VariantTag) => {
    setVariantTags((current) => ({ ...current, [variantId]: tag }));
  };

  const getVariantTag = (variantId: string): VariantTag => variantTags[variantId] ?? 'novo';

  const createLocalImageUrl = useCallback((file: Blob) => {
    const url = URL.createObjectURL(file);
    localBlobUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeLocalImageUrl = useCallback((url: string) => {
    if (!url.startsWith('blob:')) return;
    if (!localBlobUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    localBlobUrlsRef.current.delete(url);
    delete imageTypeHintsRef.current[url];
  }, []);

  useEffect(() => () => {
    localBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    localBlobUrlsRef.current.clear();
    imageTypeHintsRef.current = {};
  }, []);

  useEffect(() => {
    mediaImagesDraft.forEach((url) => {
      if (!url || imageMeta[url]) return;
      const probe = new window.Image();
      probe.onload = () => {
        const extension = imageTypeHintsRef.current[url] ?? inferImageExtensionLabel({ url });
        setImageMeta((current) => ({ ...current, [url]: { width: probe.width, height: probe.height, type: extension } }));
      };
      probe.src = url;
    });
  }, [imageMeta, mediaImagesDraft]);

  useEffect(() => {
    setSelectedImageIndexes((current) => new Set(Array.from(current).filter((index) => index >= 0 && index < mediaImagesDraft.length)));
  }, [mediaImagesDraft.length]);

  useEffect(() => {
    if (editingImageSlot === null) return;
    if (!mediaImagesDraft[editingImageSlot]) setEditingImageSlot(null);
  }, [editingImageSlot, mediaImagesDraft]);

  const updateImageAtSlot = useCallback((slotIndex: number, imageUrl: string) => {
    setMediaImagesDraft((current) => {
      const next = [...current];
      if (slotIndex < next.length) {
        const previous = next[slotIndex];
        if (previous && previous !== imageUrl) revokeLocalImageUrl(previous);
        next[slotIndex] = imageUrl;
        return next.slice(0, MEDIA_SLOT_COUNT);
      }
      while (next.length < slotIndex) next.push('');
      next.push(imageUrl);
      return next.filter(Boolean).slice(0, MEDIA_SLOT_COUNT);
    });
  }, [revokeLocalImageUrl]);

  useEffect(() => {
    updateImageAtSlotRef.current = updateImageAtSlot;
  }, [updateImageAtSlot]);

  useEffect(() => {
    const uppy = new Uppy({
      autoProceed: false,
      restrictions: {
        allowedFileTypes: ['image/*'],
        maxFileSize: 4 * 1024 * 1024,
        maxNumberOfFiles: 1
      },
      onBeforeFileAdded: (file) => {
        const plan = uploadPlanRef.current;
        if (plan.nextOffset >= plan.maxFiles) return false;
        const targetSlot = Math.min(MEDIA_SLOT_COUNT - 1, plan.startSlot + plan.nextOffset);
        plan.nextOffset += 1;
        return {
          ...file,
          meta: {
            ...file.meta,
            targetSlot
          }
        };
      }
    });

    uppy.on('restriction-failed', (_file, error) => {
      toast.error(error.message || 'Nalaganje ni uspelo. Dovoljene so le slike do 4 MB.');
    });

    uppy.on('error', (error) => {
      toast.error(error.message || 'Pri nalaganju slik je prišlo do napake.');
    });
    uppy.on('files-added', () => {
      void uppy.upload();
    });

    uppy.addUploader(async (fileIDs) => {
      fileIDs.forEach((fileID) => {
        const file = uppy.getFile(fileID);
        if (!file) return;
        const targetSlot = Number(file.meta?.targetSlot);
        if (!Number.isFinite(targetSlot)) return;
        const blob = file.data;
        if (!(blob instanceof Blob)) return;
        const localImageUrl = createLocalImageUrl(blob);
        imageTypeHintsRef.current[localImageUrl] = inferImageExtensionLabel({ mimeType: file.type, fileName: file.name });
        updateImageAtSlotRef.current(Math.max(0, Math.min(MEDIA_SLOT_COUNT - 1, targetSlot)), localImageUrl);
      });
      fileIDs.forEach((fileID) => {
        if (uppy.getFile(fileID)) uppy.removeFile(fileID);
      });
    });

    uppyRef.current = uppy;
    return () => {
      uppy.cancelAll();
      uppy.destroy();
      uppyRef.current = null;
    };
  }, [createLocalImageUrl, toast]);

  const queueImageUpload = useCallback((files: FileList | File[] | null, startSlot: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    const uppy = uppyRef.current;
    if (!uppy) return;
    const queuedFiles = Array.from(files ?? []).filter((file): file is File => file instanceof File);
    if (queuedFiles.length === 0) return;

    const remainingSlots = Math.max(0, MEDIA_SLOT_COUNT - startSlot);
    if (remainingSlots === 0) {
      toast.error('Vse reže so že zapolnjene.');
      return;
    }

    const maxFiles = Math.max(1, allowMultiple ? remainingSlots : 1);
    const acceptedFiles = queuedFiles.slice(0, maxFiles);
    if (queuedFiles.length > acceptedFiles.length) {
      toast.error(`Izberete lahko največ ${maxFiles} slik.`);
    }

    uppy.cancelAll();
    uppy.getFiles().forEach((file) => uppy.removeFile(file.id));
    uploadPlanRef.current = { startSlot, nextOffset: 0, maxFiles };
    uppy.setOptions({
      restrictions: {
        ...(uppy.opts.restrictions ?? {}),
        maxNumberOfFiles: maxFiles
      }
    });

    acceptedFiles.forEach((file) => {
      try {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Datoteke ni bilo mogoče dodati v vrsto.');
      }
    });

  }, [isMediaEditable, toast]);

  const openUppyFilePicker = useCallback((slotIndex: number, allowMultiple: boolean) => {
    if (!isMediaEditable) return;
    mediaUploadContextRef.current = { slotIndex, multiple: allowMultiple };
    const input = mediaUploadInputRef.current;
    if (!input) return;
    input.multiple = allowMultiple;
    input.value = '';
    input.click();
  }, [isMediaEditable]);

  const prepareDropzoneUploadPlan = useCallback((slotIndex: number, allowMultiple: boolean, files: File[]) => {
    if (!isMediaEditable) return;
    const uppy = uppyRef.current;
    if (!uppy) return;
    const remainingSlots = Math.max(0, MEDIA_SLOT_COUNT - slotIndex);
    const maxFiles = Math.max(1, allowMultiple ? remainingSlots : 1);
    if (files.length > maxFiles) {
      toast.error(`Izberete lahko največ ${maxFiles} slik.`);
    }
    uppy.cancelAll();
    uppy.getFiles().forEach((file) => uppy.removeFile(file.id));
    uploadPlanRef.current = { startSlot: slotIndex, nextOffset: 0, maxFiles };
    uppy.setOptions({
      restrictions: {
        ...(uppy.opts.restrictions ?? {}),
        maxNumberOfFiles: maxFiles
      }
    });
  }, [isMediaEditable, toast]);

  const moveImageSlot = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setMediaImagesDraft((current) => {
      const next = [...current];
      const image = next[fromIndex];
      if (!image) return current;
      next.splice(fromIndex, 1);
      next.splice(Math.min(toIndex, next.length), 0, image);
      return next.slice(0, MEDIA_SLOT_COUNT);
    });
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        const assignments = [...(variant.imageAssignments ?? [])];
        const fromPos = assignments.indexOf(fromIndex);
        const toPos = assignments.indexOf(toIndex);
        if (fromPos !== -1) assignments[fromPos] = toIndex;
        if (toPos !== -1) assignments[toPos] = fromIndex;
        return { ...variant, imageAssignments: assignments };
      })
    }));
  };

  const removeImageSlot = (slotIndex: number) => {
    setMediaImagesDraft((current) => {
      const imageToRemove = current[slotIndex];
      if (imageToRemove) revokeLocalImageUrl(imageToRemove);
      return current.filter((_, index) => index !== slotIndex).slice(0, MEDIA_SLOT_COUNT);
    });
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => ({
        ...variant,
        imageAssignments: (variant.imageAssignments ?? [])
          .filter((slot) => slot !== slotIndex)
          .map((slot) => (slot > slotIndex ? slot - 1 : slot))
      }))
    }));
    setEditingImageSlot((current) => {
      if (current === null) return null;
      if (current === slotIndex) return null;
      return current > slotIndex ? current - 1 : current;
    });
  };

  const removeSelectedImageSlots = (selected: Set<number>) => {
    const sorted = Array.from(selected).sort((a, b) => b - a);
    sorted.forEach((slotIndex) => removeImageSlot(slotIndex));
  };

  const assignImageToVariant = (variantIndex: number, slotIndex: number) => {
    const slotImage = mediaImagesDraft[slotIndex];
    if (!slotImage) return;
    const variant = draft.variants[variantIndex];
    if (!variant) return;
    const currentAssignments = variant.imageAssignments ?? [];
    if (currentAssignments.includes(slotIndex)) return;
    updateVariant(variantIndex, { imageAssignments: [...currentAssignments, slotIndex], imageOverride: slotImage });
  };

  const reorderVariantAssignment = (variantIndex: number, fromSlot: number, toSlot: number) => {
    const variant = draft.variants[variantIndex];
    if (!variant) return;
    const assignments = [...(variant.imageAssignments ?? [])];
    const fromIndex = assignments.indexOf(fromSlot);
    const toIndex = assignments.indexOf(toSlot);
    if (fromIndex === -1 || toIndex === -1) return;
    assignments.splice(fromIndex, 1);
    assignments.splice(toIndex, 0, fromSlot);
    updateVariant(variantIndex, {
      imageAssignments: assignments,
      imageOverride: assignments.length > 0 ? mediaImagesDraft[assignments[0]] ?? null : null
    });
  };

  const ensureImageSettings = useCallback((slotIndex: number) => {
    return imageSettings[slotIndex] ?? { altText: '', focusX: 50, focusY: 50 };
  }, [imageSettings]);

  const updateImageSettings = useCallback((slotIndex: number, updates: Partial<{ altText: string; focusX: number; focusY: number }>) => {
    setImageSettings((current) => {
      const previous = current[slotIndex] ?? { altText: '', focusX: 50, focusY: 50 };
      return {
        ...current,
        [slotIndex]: { ...previous, ...updates }
      };
    });
  }, []);

  const renderImageActionButtons = (slotIndex: number) => {
    const compact = slotIndex !== 0;
    const verticalAlignClass = compact ? 'justify-center' : 'justify-start pt-2';
    const actions = [
      {
        key: 'remove',
        label: 'Odstrani',
        tone: 'danger' as const,
        onClick: () => removeImageSlot(slotIndex),
        icon: <span aria-hidden className={`${compact ? 'text-[11px]' : 'text-sm'} leading-none`}>✕</span>
      },
      {
        key: 'replace',
        label: 'Zamenjaj sliko',
        tone: 'light' as const,
        onClick: () => openUppyFilePicker(slotIndex, false),
        icon: (
          <svg viewBox="0 0 24 24" className={`block shrink-0 ${compact ? 'h-[12px] w-[12px]' : 'h-[17.6px] w-[17.6px]'}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2.8" />
            <path d="m6.5 15.5 3.7-3.8a1 1 0 0 1 1.42 0L15 15l2-2a1 1 0 0 1 1.42 0l2.08 2.08" />
            <circle cx="15.5" cy="9.3" r="1.5" />
          </svg>
        )
      },
      {
        key: 'hide',
        label: 'Skrij',
        tone: 'light' as const,
        onClick: () => toast.info('Skrivanje slike bo na voljo kmalu.'),
        icon: (
          <svg viewBox="0 0 24 24" className={compact ? 'h-[12px] w-[12px]' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1.5 12s3.75-6.75 10.5-6.75S22.5 12 22.5 12s-3.75 6.75-10.5 6.75S1.5 12 1.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3 21 21" />
          </svg>
        )
      }
    ];

    return (
      <div className={`absolute inset-y-0 right-2 z-20 flex flex-col items-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${verticalAlignClass} ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {actions.map((action) => (
          <button
            key={`${slotIndex}-${action.key}`}
            type="button"
            className={`inline-flex items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${compact ? 'h-[20px] w-[20px]' : 'h-[25px] min-w-[1.6rem]'} ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick();
            }}
            aria-label={action.label}
            title={action.label}
          >
            <span className="inline-flex h-full w-full items-center justify-center">{action.icon}</span>
          </button>
        ))}
      </div>
    );
  };
  return (
    <div className="mx-auto max-w-7xl space-y-4 font-['Inter',system-ui,sans-serif]">
      <div className="text-xs text-slate-500"><Link href="/admin/artikli" className="hover:underline">Artikli</Link> › {mode === 'create' ? 'Nov artikel' : draft.name || 'Uredi artikel'}</div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="space-y-4">
          <section className="h-full rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="flex min-h-10 flex-1 flex-nowrap items-center gap-1 whitespace-nowrap text-lg font-semibold tracking-tight text-slate-900">
                <span className="inline-flex h-10 min-w-0 flex-1 items-center gap-0">
                  <div className={`inline-flex h-[36px] w-full min-w-[20ch] max-w-[38ch] items-center gap-2 rounded-md border border-slate-300 px-[10px] ${isEditable ? 'bg-white' : 'bg-[color:var(--ui-neutral-bg)] text-slate-500'}`}>
                    <input
                      aria-label="Naziv artikla"
                      value={draft.name}
                      disabled={!isEditable}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Naziv artikla"
                      className={articleNameInputClassName}
                    />
                  </div>
                </span>
              </h1>
              <div className="ml-auto flex items-center gap-1.5">
                <NeutralDropdownChip
                  value={articleType}
                  editable={isEditable}
                  chipClassName="!min-w-[131px]"
                  placeholderLabel="Tip artikla"
                  onChange={(value) => setArticleType(value as 'unit' | 'sheet' | 'bulk' | 'linear' | '')}
                  options={[
                    { value: 'unit', label: 'Kosovni artikel' },
                    { value: 'sheet', label: 'Ploščni artikel' },
                    { value: 'linear', label: 'Dolžinski artikel' },
                    { value: 'bulk', label: 'Sipki artikel' }
                  ]}
                />
                <ActiveStateChip active={draft.active} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, active: next }))} />
                <IconButton type="button" tone="neutral" onClick={() => setEditorMode((current) => (current === 'read' ? 'edit' : 'read'))} aria-label="Uredi artikel" title="Uredi"><PencilIcon /></IconButton>
                <IconButton type="button" tone="neutral" onClick={() => save(false)} aria-label="Shrani artikel" title="Shrani" disabled={!isEditable}><SaveIcon /></IconButton>
                <button type="button" className={buttonTokenClasses.closeX} onClick={deleteItem} aria-label="Izbriši artikel" title="Izbriši"><TrashCanIcon /></button>
              </div>
            </div>
            <div className="mx-[-1rem] mb-5 grid grid-cols-[minmax(0,1fr)] items-center border-y border-slate-200 bg-slate-50/80 px-4 py-2">
              <div className="col-span-1 flex min-h-8 items-center px-1">
                <AdminCategoryBreadcrumbPicker
                  className="flex h-8 items-center rounded-md bg-transparent px-1 !py-0"
                  value={selectedCategoryPath}
                  onChange={selectCategoryPath}
                  categoryPaths={categoryPaths}
                  disabled={!isEditable}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  { title: 'Blagovna znamka', value: sideSettings.brand, placeholder: 'AluCraft', icon: 'brand' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, brand: value })) },
                  { title: 'Material', value: sideSettings.material, placeholder: 'Aluminij', icon: 'material' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, material: value })) },
                  { title: 'Oblika', value: sideSettings.surface, placeholder: 'Pravokotna', icon: 'shape' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, surface: value })) },
                  { title: 'Barva', value: sideSettings.color, placeholder: 'Srebrna', icon: 'color' as SideFieldIcon, onChange: (value: string) => setSideSettings((current) => ({ ...current, color: value })) },
                  { title: 'Tehnični list', value: documents.map((doc) => doc.name).join(', '), placeholder: 'Dodajte dokument', icon: 'document' as SideFieldIcon, onChange: () => {} },
                  { title: 'URL', value: draft.slug, placeholder: toSlug(draft.name || 'naziv-artikla'), icon: 'link' as SideFieldIcon, onChange: (value: string) => setDraft((current) => ({ ...current, slug: value })) }
                ].map((field) => (
                  <div key={field.title} className="min-h-10">
                    <p className="text-sm font-semibold text-slate-900">{field.title}</p>
                    {field.title === 'Tehnični list' ? (
                      <div className="mt-0.5 flex items-center gap-2">
                        <input
                          type="file"
                          className="hidden"
                          id="tech-sheet-upload-inline"
                          disabled={!isEditable}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setDocuments((current) => [...current, { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }]);
                          }}
                        />
                        <label
                          htmlFor="tech-sheet-upload-inline"
                          className={`relative flex w-full items-center rounded-xl border-2 border-dashed border-[#9cb8ea] bg-[#f7f9fe] px-4 py-2.5 text-blue-500 transition ${isEditable ? 'cursor-pointer hover:border-[#4f8bff] hover:bg-[#edf3ff]' : 'cursor-not-allowed opacity-60'}`}
                        >
                          <span className="mx-auto inline-flex flex-col items-start gap-0.5 text-blue-600">
                            <span className="inline-flex items-center gap-1">
                              <SideInputIcon icon="document" muted={false} className="!text-blue-600" />
                              <span className="inline-block text-sm font-semibold leading-none">Dodaj dokument</span>
                            </span>
                            <span className="text-center text-[11px] leading-tight text-slate-500">PDF, DOC, XLSX do 10 MB</span>
                          </span>
                        </label>
                      </div>
                    ) : field.title === 'URL' ? (
                      <div className="mt-0.5 flex min-h-[52px] flex-col justify-end">
                        <div className={`${compactSideInputWrapClassName} ${isEditable ? '' : '!bg-[color:var(--ui-neutral-bg)] text-slate-500'}`}>
                          <SideInputIcon icon="link" className="h-[12.5px] w-[12.5px]" muted={field.value.trim().length === 0} />
                          <input disabled={!isEditable} className={`${compactSideInputClassName} ${isEditable ? '' : 'cursor-not-allowed text-slate-500'}`} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">URL povezava do artikla.</p>
                      </div>
                    ) : (
                      <div className={`${compactSideInputWrapClassName} ${isEditable ? '' : '!bg-[color:var(--ui-neutral-bg)] text-slate-500'}`}>
                        <SideInputIcon icon={field.icon} muted={field.value.trim().length === 0} />
                        <input disabled={!isEditable} className={`${compactSideInputClassName} ${isEditable ? '' : 'cursor-not-allowed text-slate-500'}`} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="col-span-2 space-y-1 pt-0.5">
                <label className="text-sm font-semibold text-slate-900">Opis</label>
                <OpisRichTextEditor value={draft.description} editable={isEditable} onChange={(next) => setDraft((current) => ({ ...current, description: next }))} />
              </div>
            </div>
          </section>

        </div>

        <aside className="h-full rounded-xl border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <EuiTabs
                value={mediaTab}
                onChange={(value) => setMediaTab(value as MediaTab)}
                size="compact"
                tone="muted-control"
                tabClassName="!font-['Inter',system-ui,sans-serif] !tracking-[0]"
                tabs={[
                  { value: 'slike', label: 'Slike' },
                  { value: 'video', label: 'Video' }
                ]}
              />
              <div className="flex items-center justify-end gap-1.5">
              <IconButton type="button" tone="neutral" aria-label="Uredi medije" title="Uredi" onClick={() => setMediaMode((current) => (current === 'read' ? 'edit' : 'read'))}><PencilIcon /></IconButton>
              <IconButton type="button" tone="neutral" aria-label="Shrani medije" title="Shrani" onClick={saveVideoEntries} disabled={!isMediaEditable}><SaveIcon /></IconButton>
              <IconButton
                type="button"
                tone={(mediaTab === 'video' ? Boolean(videoDraft) : selectedImageIndexes.size > 0) ? 'danger' : 'neutral'}
                aria-label="Izbriši medije"
                title="Izbriši"
                disabled={!isMediaEditable || (mediaTab === 'video' ? !videoDraft : selectedImageIndexes.size === 0)}
                onClick={() => {
                  if (mediaTab === 'video') {
                    setVideoDraft(null);
                    setYoutubeInput('');
                    setVideoMoveMode(false);
                    setVideoAssignedVariantId(null);
                    return;
                  }
                  const selected = new Set(selectedImageIndexes);
                  removeSelectedImageSlots(selected);
                  setSelectedImageIndexes(new Set());
                }}
              >
                <TrashCanIcon />
              </IconButton>
              </div>
            </div>
            {mediaTab === 'slike' ? (
              <div className="mt-3 space-y-2">
                <input
                  ref={mediaUploadInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  disabled={!isMediaEditable}
                  onChange={(event) => {
                    const { slotIndex, multiple } = mediaUploadContextRef.current;
                    queueImageUpload(event.target.files, slotIndex, multiple);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="h-[11.5rem]">
                  {mediaImagesDraft.length === 0 ? (
                    uppyRef.current ? (
                      <UppyDropzoneField
                        uppy={uppyRef.current}
                        disabled={!isMediaEditable}
                        onPrepareAddFiles={(files) => prepareDropzoneUploadPlan(0, true, files)}
                        className="flex h-full w-full items-center justify-center rounded-lg text-blue-600"
                      >
                        <span className="flex flex-col items-center justify-center gap-2 text-center">
                          <ImageUploadFrameIcon className="h-[84px] w-[84px] text-[#2f7dc5]" />
                          <span className="text-base font-semibold text-slate-800">Naloži sliko</span>
                          <span className="text-xs font-medium text-slate-500">(največ 4 MB)</span>
                        </span>
                      </UppyDropzoneField>
                    ) : (
                      <div className={`relative flex h-full w-full items-center justify-center rounded-lg bg-[#f7f9fe] text-blue-600 ${isMediaEditable ? '' : 'cursor-not-allowed opacity-60'}`}>
                        <span className="flex flex-col items-center justify-center gap-2 text-center">
                          <ImageUploadFrameIcon className="h-[84px] w-[84px] text-[#2f7dc5]" />
                          <span className="text-base font-semibold text-slate-800">Naloži sliko</span>
                          <span className="text-xs font-medium text-slate-500">(največ 4 MB)</span>
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="grid h-full grid-cols-5 grid-rows-2 gap-2">
                      <div
                        className={`group relative col-span-2 row-span-2 overflow-hidden rounded-lg border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
                        draggable={Boolean(isMediaEditable)}
                        onDragStart={() => {
                          suppressImageClickAfterDragRef.current = true;
                          setDraggedImageIndex(0);
                        }}
                        onDragEnd={() => {
                          suppressImageClickAfterDragRef.current = false;
                        }}
                        onDragOver={(event) => {
                          if (!isMediaEditable) return;
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!isMediaEditable || draggedImageIndex === null) return;
                          moveImageSlot(draggedImageIndex, 0);
                          setDraggedImageIndex(null);
                          suppressImageClickAfterDragRef.current = false;
                        }}
                        onClick={() => {
                          if (suppressImageClickAfterDragRef.current) {
                            suppressImageClickAfterDragRef.current = false;
                            return;
                          }
                          setEditingImageSlot(0);
                        }}
                      >
                        <Image src={mediaImagesDraft[0]} alt="Glavna slika" width={1200} height={1200} unoptimized sizes="(max-width: 1280px) 36vw, 420px" className="h-full w-full object-cover" />
                        {renderImageActionButtons(0)}
                      </div>
                      {Array.from({ length: GALLERY_SMALL_SLOT_COUNT }).map((_, smallIndex) => {
                        const slotIndex = smallIndex + 1;
                        const slotImage = mediaImagesDraft[slotIndex];
                        const nextUploadSlot = Math.min(mediaImagesDraft.length, MEDIA_SLOT_COUNT - 1);
                        const isActiveUploadSlot = !slotImage && mediaImagesDraft.length < MEDIA_SLOT_COUNT && slotIndex === nextUploadSlot;

                        if (slotImage) {
                          return (
                            <div
                              key={`slot-${slotIndex}`}
                              className={`group relative overflow-hidden rounded-lg border border-slate-300 ${isMediaEditable ? 'cursor-grab' : ''}`}
                              draggable={Boolean(isMediaEditable)}
                              onDragStart={() => {
                                suppressImageClickAfterDragRef.current = true;
                                setDraggedImageIndex(slotIndex);
                              }}
                              onDragEnd={() => {
                                suppressImageClickAfterDragRef.current = false;
                              }}
                              onDragOver={(event) => {
                                if (!isMediaEditable) return;
                                event.preventDefault();
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (!isMediaEditable || draggedImageIndex === null) return;
                                moveImageSlot(draggedImageIndex, slotIndex);
                                setDraggedImageIndex(null);
                                suppressImageClickAfterDragRef.current = false;
                              }}
                              onClick={() => {
                                if (suppressImageClickAfterDragRef.current) {
                                  suppressImageClickAfterDragRef.current = false;
                                  return;
                                }
                                setEditingImageSlot(slotIndex);
                              }}
                            >
                              <Image src={slotImage} alt={`Slika ${slotIndex + 1}`} width={720} height={720} unoptimized sizes="(max-width: 1280px) 18vw, 180px" className="h-full w-full object-cover" />
                              {renderImageActionButtons(slotIndex)}
                            </div>
                          );
                        }

                        if (isActiveUploadSlot) {
                          return (
                            uppyRef.current ? (
                              <UppyDropzoneField
                                key={`slot-${slotIndex}`}
                                uppy={uppyRef.current}
                                disabled={!isMediaEditable}
                                onPrepareAddFiles={(files) => prepareDropzoneUploadPlan(slotIndex, true, files)}
                                className="flex h-full items-center justify-center rounded-lg text-blue-600"
                              >
                                <span className="inline-flex h-full w-full items-center justify-center">
                                  <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#2f7dc5]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M12 5v14M5 12h14" />
                                  </svg>
                                </span>
                              </UppyDropzoneField>
                            ) : (
                              <div key={`slot-${slotIndex}`} className={`relative flex h-full items-center justify-center rounded-lg bg-[#f7f9fe] text-blue-600 ${isMediaEditable ? '' : 'cursor-not-allowed opacity-60'}`}>
                                <CloudUploadIcon className="h-8 w-8 text-[#2f7dc5]" />
                              </div>
                            )
                          );
                        }

                        return <div key={`slot-${slotIndex}`} className="relative h-full rounded-lg border-2 border-dashed border-[#d7e3f7] bg-[#f7f9fe] opacity-70" />;
                      })}
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left">SKU</th>
                        <th className="px-2 py-1.5 text-center">Tip</th>
                        <th className="px-2 py-1.5 text-center">Dimenzije</th>
                        <th className="px-2 py-1.5 text-left">Slike</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant, variantIndex) => {
                        const assignedSlots = variant.imageAssignments ?? [];
                        const assignedImageDetails = assignedSlots.flatMap((slot) => {
                          const url = mediaImagesDraft[slot];
                          if (!url) return [];
                          const typeLabel = imageMeta[url]?.type ?? imageTypeHintsRef.current[url] ?? inferImageExtensionLabel({ url });
                          const dimensionLabel = imageMeta[url] ? `${imageMeta[url].width}x${imageMeta[url].height}` : '—';
                          return [{ typeLabel, dimensionLabel }];
                        });
                        const assignedImageTypes = assignedImageDetails.map((entry) => entry.typeLabel);
                        const assignedImageDimensions = assignedImageDetails.map((entry) => entry.dimensionLabel);
                        return (
                          <tr
                            key={`variant-media-${variant.id}`}
                            className="border-t border-slate-100"
                            onDragOver={(event) => {
                              if (!isMediaEditable) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!isMediaEditable || draggedImageIndex === null) return;
                              assignImageToVariant(variantIndex, draggedImageIndex);
                              setDraggedImageIndex(null);
                            }}
                          >
                            <td className="px-2 py-1.5">{variant.sku || '—'}</td>
                            <td className="px-2 py-1.5 text-center">{assignedImageTypes.length ? assignedImageTypes.join(', ') : '—'}</td>
                            <td className="px-2 py-1.5 text-center">{assignedImageDimensions.length ? assignedImageDimensions.join(', ') : '—'}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-wrap gap-1">
                                {assignedSlots.map((slot) => {
                                  const slotImage = mediaImagesDraft[slot];
                                  if (!slotImage) return null;
                                  return (
                                    <div
                                      key={`${variant.id}-${slot}`}
                                      className="inline-flex h-[18px] items-center gap-1 overflow-hidden rounded-md border border-slate-200 bg-white px-1"
                                      draggable={isMediaEditable}
                                      onDragStart={() => {
                                        setDraggedVariantId(variant.id);
                                        setDraggedVariantImageSlot(slot);
                                      }}
                                      onDragOver={(event) => {
                                        if (!isMediaEditable) return;
                                        event.preventDefault();
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault();
                                        if (!isMediaEditable || draggedVariantId !== variant.id || draggedVariantImageSlot === null) return;
                                        reorderVariantAssignment(variantIndex, draggedVariantImageSlot, slot);
                                        setDraggedVariantId(null);
                                        setDraggedVariantImageSlot(null);
                                      }}
                                    >
                                      <Image src={slotImage} alt={`SKU ${variant.sku}`} width={16} height={16} unoptimized className="h-4 w-4 shrink-0 rounded object-cover" />
                                      <span className="max-w-[84px] truncate text-[11px] text-slate-600">Slika {slot + 1}</span>
                                      <button
                                        type="button"
                                        disabled={!isMediaEditable}
                                        className="text-slate-400 hover:text-rose-600"
                                        onClick={() => updateVariant(variantIndex, {
                                          imageAssignments: assignedSlots.filter((value) => value !== slot),
                                          imageOverride: assignedSlots.length > 1 ? mediaImagesDraft[assignedSlots.find((value) => value !== slot) ?? 0] ?? null : null
                                        })}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  disabled={!isMediaEditable}
                  className="hidden"
                  onChange={(event) => {
                    handleVideoFileSelect(event.target.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="h-[11.5rem]">
                  {videoDraft ? (
                    <div className="group relative h-full overflow-hidden rounded-lg border border-slate-300 bg-black">
                      {videoDraft.source === 'youtube' ? (
                        <iframe
                          title="Predogled videa"
                          className="h-full w-full"
                          src={videoDraft.previewUrl}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video controls className="h-full w-full object-contain">
                          <source src={videoDraft.previewUrl} />
                        </video>
                      )}
                      <div className="absolute inset-y-0 right-2 z-20 flex flex-col items-end justify-start gap-1.5 pt-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        {[
                          { key: 'remove', label: 'Odstrani', tone: 'danger' as const, onClick: () => setVideoDraft(null), icon: <span aria-hidden className="text-sm leading-none">✕</span> },
                          {
                            key: 'move',
                            label: 'Premakni',
                            tone: 'light' as const,
                            onClick: () => {
                              setVideoMoveMode(true);
                              toast.info('Izberite ciljno celico v stolpcu Video.');
                            },
                            icon: <span className="text-[11px]">↕</span>
                          }
                        ].map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            className={`inline-flex h-[25px] min-w-[1.6rem] items-center justify-center rounded-md border px-0 leading-none shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${action.tone === 'danger' ? 'border-[#f1c1bd] bg-white text-[#d2554a] hover:bg-[#fff7f6]' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (action.key === 'remove') {
                                setVideoAssignedVariantId(null);
                                setVideoMoveMode(false);
                              }
                              action.onClick();
                            }}
                            aria-label={action.label}
                            title={action.label}
                          >
                            <span className="inline-flex h-full w-full items-center justify-center">{action.icon}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative flex h-full w-full flex-col items-center justify-between rounded-lg border-2 border-dashed bg-[#f7f9fe] px-5 pb-4 pt-3 text-center transition ${videoDragActive ? 'border-[#4f8bff] bg-[#edf3ff]' : 'border-[#9cb8ea]'} ${isMediaEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                      onClick={() => {
                        if (!isMediaEditable) return;
                        document.getElementById('video-upload-input')?.click();
                      }}
                      onDragEnter={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(true);
                      }}
                      onDragOver={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(true);
                      }}
                      onDragLeave={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setVideoDragActive(false);
                        }
                      }}
                      onDrop={(event) => {
                        if (!isMediaEditable) return;
                        event.preventDefault();
                        setVideoDragActive(false);
                        handleVideoFileSelect(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <div className="flex flex-1 flex-col items-center justify-center">
                        <VideoUploadFrameIcon className="h-[72px] w-[72px] text-[#74addb]" />
                        <div className="mt-1 flex flex-col items-center justify-center leading-tight">
                          <span className="text-base font-semibold text-slate-800">Naloži video</span>
                          <span className="mt-1 text-xs font-medium text-slate-500">(največ 100 MB)</span>
                        </div>
                      </div>
                      <div className="mt-3 w-full max-w-[340px] pb-1">
                        <div
                          className="flex h-[30px] items-center gap-1 rounded-md border border-slate-200 bg-white px-1"
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <input
                            className="h-full w-full border-0 bg-transparent px-1.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
                            value={youtubeInput}
                            disabled={!isMediaEditable}
                            onChange={(event) => setYoutubeInput(event.target.value)}
                            onPaste={(event) => {
                              const pastedText = event.clipboardData.getData('text');
                              const didEmbed = submitYoutubeVideo(pastedText);
                              if (didEmbed) {
                                event.preventDefault();
                              }
                            }}
                            onBlur={() => {
                              if (!youtubeInput.trim()) return;
                              void submitYoutubeVideo(youtubeInput, { showError: true });
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              submitYoutubeVideo(youtubeInput, { showError: true });
                            }}
                            placeholder="https://youtube.com/watch?v=..."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left">SKU</th>
                        <th className="px-2 py-1.5 text-center">Tip</th>
                        <th className="px-2 py-1.5 text-left">Video</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.variants.map((variant) => {
                        const hasVideoInCell = Boolean(videoDraft) && videoAssignedVariantId === variant.id;
                        const canPlaceHere = Boolean(videoDraft) && isMediaEditable && videoMoveMode;
                        return (
                        <tr key={`variant-video-${variant.id}`} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">{variant.sku || '—'}</td>
                          <td className="px-2 py-1.5 text-center">{hasVideoInCell ? (videoDraft?.source === 'youtube' ? 'YouTube' : 'Upload') : '—'}</td>
                          <td className="px-2 py-1.5 text-left">
                            <button
                              type="button"
                              disabled={!canPlaceHere && !hasVideoInCell}
                              className={`inline-flex h-[18px] items-center gap-1 overflow-hidden rounded-md border px-1 text-[11px] transition ${hasVideoInCell ? 'border-slate-200 bg-white text-slate-600' : canPlaceHere ? 'border-[#9cb8ea] bg-[#f0f6ff] text-[#2f7dc5] hover:bg-[#e6f0ff]' : 'border-transparent bg-transparent text-slate-400'}`}
                              onClick={() => {
                                if (!canPlaceHere) return;
                                setVideoAssignedVariantId(variant.id);
                                setVideoMoveMode(false);
                              }}
                            >
                              {hasVideoInCell ? (
                                <span className="max-w-[120px] truncate">{videoDraft?.label}</span>
                              ) : canPlaceHere ? 'Postavi video' : '—'}
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white px-4 pb-5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Uredi artikel</h2>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              aria-label="Uredi tabelo artikla"
              title={isTableEditable ? 'Zaključi urejanje' : 'Uredi'}
              tone="neutral"
              onClick={() => setTableEditorMode((current) => (current === 'read' ? 'edit' : 'read'))}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Dodaj različico"
              title="Dodaj različico"
              tone="neutral"
              disabled={!isTableEditable}
              onClick={() => setDraft((current) => ({ ...current, variants: [...current.variants, createVariant({ sort: current.variants.length + 1 })] }))}
            >
              <PlusIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Shrani tabelo artikla"
              title="Shrani"
              tone="neutral"
              disabled={!isTableEditable}
              onClick={() => setTableEditorMode('read')}
            >
              <SaveIcon />
            </IconButton>
            <IconButton
              type="button"
              aria-label="Odstrani izbrane različice"
              title="Izbriši izbrane"
              tone={hasSelectedVariants ? 'danger' : 'neutral'}
              disabled={!isTableEditable || !hasSelectedVariants}
              onClick={deleteSelectedVariants}
            >
              <TrashCanIcon />
            </IconButton>
            <Button type="button" variant="primary" size="toolbar" className="!h-8 !rounded-lg !px-3 !text-xs" onClick={generateVariants}>Generiraj različice</Button>
          </div>
        </div>
        <div className="mb-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Dimenzije</h3>
          <p className="text-xs text-slate-500">
            Vnesi vrednosti (v mm) za vsako dimenzijo posebej, na primer: <span className={inlineSnippetClass}>Dolžina: 10,20</span>. Podprte so Dolžina, Širina/fi in Debelina, razen pri dolžinskih artiklih, kjer Debelina ni dovoljena. Za posamezno dimenzijo lahko dodaš največ pet vrednosti. Ob generiranju se na podlagi vseh vnesenih kombinacij ustvarijo različice.
          </p>
          <p className="whitespace-nowrap text-xs leading-5 text-slate-700">
            <span className="font-semibold">Dodaj do tri dimenzije. Vnosne bližnjice:</span>{' '}
            <span className={`${inlineSnippetClass} !font-normal`}>d:</span>, <span className={`${inlineSnippetClass} !font-normal`}>š:</span>, <span className={`${inlineSnippetClass} !font-normal`}>fi:</span>, <span className={`${inlineSnippetClass} !font-normal`}>h:</span>, <span className={`${inlineSnippetClass} !font-normal`}>v:</span>
          </p>
          <div className="pt-2">
            <div className="flex items-start gap-3">
            <div className="relative w-1/2 min-w-[300px]">
              <div className={`flex h-[30px] flex-nowrap items-center gap-2 overflow-hidden rounded-md border border-slate-300 pl-[10px] pr-11 ${isGeneratorLocked ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : 'bg-white'}`}>
                <SideInputIcon icon="dimension" muted={generatorInput.trim().length === 0 && generatorChips.length === 0} />
                {generatorChips.map((chip) => (
                  <span key={chip.dimension} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                    <button
                      type="button"
                      className="whitespace-nowrap hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => {
                        setGeneratorInput(`${generatorDimensionLabels[chip.dimension]}: ${chip.values.join(',')}`);
                        setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension));
                      }}
                    >
                      {`${generatorDimensionLabels[chip.dimension]}: ${chip.values.join(', ')}`}
                    </button>
                    <button
                      type="button"
                      aria-label={`Odstrani ${generatorDimensionLabels[chip.dimension]}`}
                      className="text-slate-500 transition hover:text-rose-600 active:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
                      disabled={isGeneratorLocked}
                      onClick={() => setGeneratorChips((current) => current.filter((entry) => entry.dimension !== chip.dimension))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className={`h-full min-w-0 flex-1 border-0 bg-transparent text-xs outline-none focus:ring-0 ${isGeneratorLocked ? 'cursor-not-allowed text-slate-500' : 'text-slate-900'}`}
                  value={generatorInput}
                  disabled={isGeneratorLocked}
                  onChange={(event) => {
                    setGeneratorInput(event.target.value);
                    if (generatorError) setGeneratorError(null);
                  }}
                  placeholder={generatorChips.length > 0 ? '' : 'Dolžina: 10,20 + enter'}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    submitGeneratorEntry();
                  }}
                />
              </div>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{combinationCount}</span>
            </div>
            <label className="ml-auto mt-0.5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>Cena:</span>
              <span className={`relative inline-flex h-[30px] items-center gap-2 rounded-md border border-slate-300 bg-white pl-[10px] pr-16 ${!isTableEditable ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`}>
                <SideInputIcon icon="price" muted={generatorPriceInput.trim().length === 0} />
                <input
                  type="number"
                  inputMode="decimal"
                  value={generatorPriceInput}
                  disabled={!isTableEditable}
                  onChange={(event) => setGeneratorPriceInput(event.target.value)}
                  className={`h-full w-40 border-0 bg-transparent p-0 text-right text-sm outline-none focus:ring-0 ${!isTableEditable ? 'cursor-not-allowed text-slate-500' : 'text-slate-900'}`}
                />
                <span className="pointer-events-none absolute right-3 text-xs font-medium text-slate-500">{generatorUnitLabel}</span>
              </span>
            </label>
          </div>
          </div>
          <div className="text-xs">
            {generatorError ? <span className="text-rose-600">{generatorError}</span> : null}
          </div>
        </div>
        <div className="relative overflow-x-auto overflow-y-visible rounded-lg border border-slate-200">
          <table className="min-w-full text-[11px] leading-4">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-center">
                  <AdminCheckbox
                    checked={isTableEditable && allVariantsSelected}
                    onChange={() =>
                      setVariantSelections(allVariantsSelected ? new Set() : new Set(draft.variants.map((variant) => variant.id)))
                    }
                    disabled={!isTableEditable}
                  />
                </th>
                <th className="px-2 py-2 text-right">Dolžina</th>
                <th className="px-2 py-2 text-right">Širina/fi</th>
                <th className="px-2 py-2 text-right">Debelina</th>
                <th className="px-2 py-2 text-right">Teža (g)</th>
                <th className="px-2 py-2 text-center">Toleranca</th>
                <th className="px-2 py-2 text-right">Cena</th>
                <th className="px-2 py-2 text-right">Popust %</th>
                <th className="px-2 py-2 text-right">Akcijska cena</th>
                <th className="px-2 py-2 text-right">Zaloga</th>
                <th className="px-2 py-2 text-center">Min/nar.</th>
                <th className="px-2 py-2 text-center">SKU</th>
                <th className="px-1 py-2 text-center">Status</th>
                <th className="px-1 py-2 text-center">Opomba</th>
                <th className="px-2 py-2 text-center">Mesto</th>
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant, index) => (
                <tr key={variant.id} className="h-8 border-t border-slate-100 align-middle">
                  <td className="px-2 py-1.5 text-center"><AdminCheckbox checked={variantSelections.has(variant.id)} onChange={() => setVariantSelections((current) => { const next = new Set(current); if (next.has(variant.id)) next.delete(variant.id); else next.add(variant.id); return next; })} disabled={!isTableEditable} /></td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" disabled={isDimensionLockActive} className={`${compactTableNumberInputClassName} !w-[7ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.length ?? ''} onChange={(event) => updateVariant(index, { length: Number(event.target.value) || 0 })} /></span> : <span className={`inline-flex h-5 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className="inline-flex h-5 w-[7ch] items-center justify-end">{variant.length ?? '—'}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" disabled={isDimensionLockActive} className={`${compactTableNumberInputClassName} !w-[7ch] text-right ${isDimensionLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.width ?? ''} onChange={(event) => updateVariant(index, { width: Number(event.target.value) || 0 })} /></span> : <span className={`inline-flex h-5 w-full justify-end ${isDimensionLockActive ? 'text-slate-500' : ''}`}><span className="inline-flex h-5 w-[7ch] items-center justify-end">{variant.width ?? '—'}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" disabled={isThicknessLockActive} className={`${compactTableNumberInputClassName} !w-[7ch] text-right ${isThicknessLockActive ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`} value={variant.thickness ?? ''} onChange={(event) => updateVariant(index, { thickness: Number(event.target.value) || 0 })} /></span> : <span className={`inline-flex h-5 w-full justify-end ${isThicknessLockActive ? 'text-slate-500' : ''}`}><span className="inline-flex h-5 w-[7ch] items-center justify-end">{variant.thickness ?? '—'}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" className={`${compactTableNumberInputClassName} !mt-0 !w-[7ch] text-right`} value={sideSettings.weightPerUnit} onChange={(event) => setSideSettings((current) => ({ ...current, weightPerUnit: event.target.value }))} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-[7ch] items-center justify-end">{sideSettings.weightPerUnit || '—'}</span></span>}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isTableEditable ? (
                      <div className="inline-flex h-5 w-[52px] items-center justify-center gap-0.5">
                        <span className="text-slate-500">±</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          disabled={isToleranceLocked}
                          className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center ${isToleranceLocked ? '!bg-[color:var(--ui-neutral-bg)] text-slate-500' : ''}`}
                          value={sideSettings.thicknessTolerance}
                          onChange={(event) => {
                            if (isToleranceLocked) return;
                            setSideSettings((current) => ({ ...current, thicknessTolerance: event.target.value }));
                          }}
                        />
                      </div>
                    ) : (
                      <span className="inline-flex h-5 w-[52px] items-center justify-center">{sideSettings.thicknessTolerance ? `±${sideSettings.thicknessTolerance}` : '—'}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" className={`${compactTableNumberInputClassName} !mt-0 !w-[7ch] text-right`} value={variant.price} onChange={(event) => updateVariant(index, { price: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-[7ch] items-center justify-end">{formatCurrency(variant.price)}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="decimal" min={0} max={99.9} step={0.1} className={`${compactTableNumberInputClassName} !mt-0 !w-[7ch] text-right`} value={variant.discountPct} onChange={(event) => updateVariant(index, { discountPct: Math.min(99.9, Math.max(0, Number(event.target.value) || 0)) })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 w-[7ch] items-center justify-end">{variant.discountPct}</span></span>}</td>
                  <td className="px-2 py-1.5 text-right"><span className="inline-flex h-5 items-center justify-end">{formatCurrency(computeSalePrice(variant.price, variant.discountPct))}</span></td>
                  <td className="px-2 py-1.5 text-right">{isTableEditable ? <span className="inline-flex w-full justify-end"><input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-auto !max-w-[6ch] text-right`} value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) || 0 })} /></span> : <span className="inline-flex h-5 w-full justify-end"><span className="inline-flex h-5 max-w-[6ch] items-center justify-end">{variant.stock}</span></span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center`} value={sideSettings.moq} onChange={(event) => setSideSettings((current) => ({ ...current, moq: Number(event.target.value) || 1 }))} /> : <span className="inline-flex h-5 w-10 items-center justify-center">{sideSettings.moq}</span>}</td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input className={`${orderLikeEditableInputClassName} !mt-0 !h-5 !w-[20ch] text-center`} value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} /> : <span className="inline-flex h-5 w-[20ch] items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap text-center">{variant.sku || '—'}</span>}</td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <ActiveStateChip
                        active={variant.active}
                        editable={isTableEditable}
                        chipClassName="!h-5 !min-w-[94px] !px-1.5 !text-[10px]"
                        menuPlacement="bottom"
                        onChange={(next) => updateVariant(index, { active: next })}
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <div className="inline-flex justify-center">
                      <TagStateChip
                        value={getVariantTag(variant.id)}
                        editable={isTableEditable}
                        chipClassName="!h-5 !min-w-[94px] !px-1.5 !text-[10px]"
                        menuPlacement="bottom"
                        onChange={(next) => setVariantTag(variant.id, next)}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">{isTableEditable ? <input type="number" inputMode="numeric" className={`${compactTableNumberInputClassName} !mt-0 !w-10 text-center`} value={variant.sort} onChange={(event) => updateVariant(index, { sort: Number(event.target.value) || 1 })} /> : <span className="inline-flex h-5 w-10 items-center justify-center">{variant.sort}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editingImageSlot !== null && mediaImagesDraft[editingImageSlot]
        ? createPortal(
          <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Urejanje slike {editingImageSlot + 1}</span>
                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setEditingImageSlot(null)}>Zapri</button>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                <div
                  className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * 100;
                    const y = ((event.clientY - rect.top) / rect.height) * 100;
                    updateImageSettings(editingImageSlot, { focusX: Math.max(0, Math.min(100, x)), focusY: Math.max(0, Math.min(100, y)) });
                  }}
                >
                  <Image src={mediaImagesDraft[editingImageSlot]} alt={`Urejanje slike ${editingImageSlot + 1}`} fill unoptimized className="object-cover" />
                  <span
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#3e67d6] shadow"
                    style={{ left: `${ensureImageSettings(editingImageSlot).focusX}%`, top: `${ensureImageSettings(editingImageSlot).focusY}%` }}
                  />
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Alt besedilo</label>
                    <input
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-[#3e67d6]"
                      value={ensureImageSettings(editingImageSlot).altText}
                      onChange={(event) => updateImageSettings(editingImageSlot, { altText: event.target.value })}
                      placeholder={`Slika ${editingImageSlot + 1}`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-600">Fokus slike</label>
                    <p className="text-[11px] text-slate-500">Kliknite na predogled, da nastavite fokus prikaza.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
        : null}
    </div>
  );
}
