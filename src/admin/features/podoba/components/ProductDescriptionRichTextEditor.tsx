'use client';

import { Editor, Extension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import TiptapUnderline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Underline
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref
} from 'react';
import { adminControlFocusTokenClasses } from '@/shared/ui/theme/tokens';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import {
  AppearanceEditorCompactSelect,
  AppearanceEditorNumberInput
} from './AppearanceEditorToolbarPrimitives';

const FontSize = Extension.create({
  name: 'productDescriptionFontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element: HTMLElement) => element.style.fontSize || null,
          renderHTML: (attributes: { fontSize?: string | null }) => (
            attributes.fontSize
              ? { style: `font-size: ${attributes.fontSize}` }
              : {}
          )
        }
      }
    }];
  }
});

const fontFamilies = [
  { label: 'Privzeta pisava', value: '' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' }
] as const;

export function resolveProductDescriptionFontSize(
  activeFontSize: unknown,
  defaultFontSizePx = 16
) {
  const parsedActive = typeof activeFontSize === 'string'
    ? Number.parseFloat(activeFontSize)
    : Number.NaN;
  const resolved = Number.isFinite(parsedActive) && parsedActive > 0
    ? parsedActive
    : defaultFontSizePx > 0
      ? defaultFontSizePx
      : 16;
  return String(Math.round(resolved * 100) / 100);
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  buttonRef,
  controls,
  expanded,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  controls?: string;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      aria-haspopup={controls ? 'dialog' : undefined}
      aria-expanded={controls ? expanded : undefined}
      aria-controls={controls}
      data-product-description-link-trigger={controls ? 'true' : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border text-white transition disabled:cursor-not-allowed disabled:opacity-35 ${adminControlFocusTokenClasses} ${
        active
          ? 'border-sky-300/70 bg-sky-400/25'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export default function ProductDescriptionRichTextEditor({
  value,
  onChange,
  defaultFontSizePx = 16,
  editable = true
}: {
  value: string;
  onChange: (value: string) => void;
  defaultFontSizePx?: number;
  editable?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value || '<p></p>');
  const [revision, setRevision] = useState(0);
  const [fontSize, setFontSize] = useState(() =>
    resolveProductDescriptionFontSize(null, defaultFontSizePx)
  );
  const [textColor, setTextColor] = useState('#64748b');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const linkTriggerRef = useRef<HTMLButtonElement | null>(null);
  const linkPanelRef = useRef<HTMLDivElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const linkDismissRefs = useMemo(() => [linkTriggerRef, linkPanelRef] as const, []);
  const linkPanelId = useId();

  const closeLinkPanel = useCallback(() => setLinkOpen(false), []);
  const closeLinkPanelAndRestoreFocus = useCallback(() => {
    closeLinkPanel();
    window.requestAnimationFrame(() => linkTriggerRef.current?.focus());
  }, [closeLinkPanel]);

  useDropdownDismiss({
    open: linkOpen,
    onClose: closeLinkPanel,
    refs: linkDismissRefs,
    returnFocusRef: linkTriggerRef,
    dismissGroup: 'product-description-rich-text-toolbar'
  });

  useEffect(() => {
    if (!linkOpen) return;
    const frame = window.requestAnimationFrame(() => linkInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [linkOpen]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;
    const editor = new Editor({
      element: hostRef.current,
      editable,
      extensions: [
        StarterKit.configure({ link: false, underline: false }),
        TiptapUnderline,
        TextStyle,
        FontSize,
        Highlight.configure({ multicolor: true }),
        Color,
        FontFamily,
        TiptapLink.configure({ openOnClick: false, defaultProtocol: 'https' }),
        TiptapImage,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder: 'Opis artikla …' })
      ],
      content: initialValueRef.current,
      editorProps: {
        attributes: {
          class: 'min-h-32 px-3 py-2.5 text-[12px] leading-5 text-slate-800 outline-none'
        }
      },
      onUpdate: ({ editor: nextEditor }) => {
        onChangeRef.current(nextEditor.getHTML());
        setRevision((current) => current + 1);
      },
      onSelectionUpdate: () => setRevision((current) => current + 1)
    });
    editorRef.current = editor;
    setRevision((current) => current + 1);
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const editor = editorRef.current;
    const nextValue = value || '<p></p>';
    if (!editor || editor.getHTML() === nextValue) return;
    editor.commands.setContent(nextValue, { emitUpdate: false });
    setRevision((current) => current + 1);
  }, [value]);

  const run = useCallback((action: (editor: Editor) => void) => {
    const editor = editorRef.current;
    if (!editor || !editable) return;
    action(editor);
    editor.commands.focus();
  }, [editable]);

  const editor = editorRef.current;
  const activeFontFamily = (editor?.getAttributes('textStyle').fontFamily as string | undefined) ?? '';
  useEffect(() => {
    const activeFontSize = editorRef.current
      ?.getAttributes('textStyle')
      .fontSize;
    setFontSize(
      resolveProductDescriptionFontSize(activeFontSize, defaultFontSizePx)
    );
  }, [defaultFontSizePx, revision]);

  const applyFontSize = (nextValue: string) => {
    setFontSize(nextValue);
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    run((instance) => instance.chain().setMark('textStyle', {
      fontSize: `${parsed}px`
    }).run());
  };
  const applyLink = () => {
    const normalized = linkUrl.trim();
    if (!normalized) return;
    run((instance) => instance.chain().setLink({ href: normalized }).run());
    setLinkOpen(false);
  };

  return (
    <div
      data-testid="product-description-rich-text-editor"
      className="overflow-hidden rounded-lg border border-white/15 bg-white"
    >
      <div
        role="toolbar"
        aria-label="Oblikovanje opisa artikla"
        className="flex flex-wrap items-center gap-1 border-b border-white/15 bg-slate-800 p-2"
      >
        <ToolbarButton label="Krepko" active={Boolean(editor?.isActive('bold'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleBold().run())}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Ležeče" active={Boolean(editor?.isActive('italic'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleItalic().run())}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Podčrtano" active={Boolean(editor?.isActive('underline'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleUnderline().run())}>
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-6 w-px bg-white/15" aria-hidden />
        <ToolbarButton label="Točkovni seznam" active={Boolean(editor?.isActive('bulletList'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleBulletList().run())}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Oštevilčen seznam" active={Boolean(editor?.isActive('orderedList'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleOrderedList().run())}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <AppearanceEditorCompactSelect
          value={editor?.isActive('heading', { level: 2 }) ? 'h2' : editor?.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
          tone="dark"
          disabled={!editable}
          options={[
            { value: 'p', label: 'Odstavek' },
            { value: 'h2', label: 'Naslov 2' },
            { value: 'h3', label: 'Naslov 3' }
          ]}
          ariaLabel="Slog odstavka"
          marker="product-description-block-style"
          className="w-24"
          triggerClassName="h-7 rounded-md px-2 text-[10px]"
          onValueChange={(blockStyle) => run((instance) => {
            if (blockStyle === 'h2') instance.chain().toggleHeading({ level: 2 }).run();
            else if (blockStyle === 'h3') instance.chain().toggleHeading({ level: 3 }).run();
            else instance.chain().setParagraph().run();
          })}
        />
        <label className="flex h-7 items-center overflow-hidden rounded-md border border-white/15 bg-slate-700">
          <span className="sr-only">Velikost pisave</span>
          <AppearanceEditorNumberInput
            min={8}
            max={96}
            value={Number(fontSize)}
            disabled={!editable}
            onValueChange={(value) => applyFontSize(String(value))}
            placeholder="px"
            className="h-full w-12 bg-transparent px-1.5 text-right text-[10px] text-white outline-none placeholder:text-white/45"
          />
          <span className="pr-1.5 text-[9px] text-white/55">px</span>
        </label>
        <AppearanceEditorCompactSelect
          value={activeFontFamily}
          tone="dark"
          disabled={!editable}
          options={fontFamilies}
          ariaLabel="Pisava"
          marker="product-description-font-family"
          className="w-28"
          triggerClassName="h-7 rounded-md px-2 text-[10px]"
          onValueChange={(fontFamily) => run((instance) => {
            if (fontFamily) instance.chain().setFontFamily(fontFamily).run();
            else instance.chain().unsetFontFamily().run();
          })}
        />
        <CompactHexColorField
          label="Barva besedila"
          value={textColor}
          marker="product-description-text-color"
          tone="dark"
          layout="inline"
          disabled={!editable}
          onChange={(color) => {
            setTextColor(color);
            run((instance) => instance.chain().setColor(color).run());
          }}
          className="[&>label]:sr-only"
        />
        <ToolbarButton label="Označi besedilo" active={Boolean(editor?.isActive('highlight'))} disabled={!editable} onClick={() => run((instance) => instance.chain().toggleHighlight({ color: '#fde68a' }).run())}>
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Povezava"
          active={Boolean(editor?.isActive('link'))}
          disabled={!editable}
          buttonRef={linkTriggerRef}
          controls={linkPanelId}
          expanded={linkOpen}
          onClick={() => {
            if (editor?.isActive('link')) run((instance) => instance.chain().unsetLink().run());
            else setLinkOpen((open) => !open);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Vodoravna črta" disabled={!editable} onClick={() => run((instance) => instance.chain().setHorizontalRule().run())}>
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-0.5 h-6 w-px bg-white/15" aria-hidden />
        {([
          ['Leva poravnava', AlignLeft, 'left'],
          ['Sredinska poravnava', AlignCenter, 'center'],
          ['Desna poravnava', AlignRight, 'right'],
          ['Obojestranska poravnava', AlignJustify, 'justify']
        ] as const).map(([label, Icon, alignment]) => (
          <ToolbarButton key={alignment} label={label} active={Boolean(editor?.isActive({ textAlign: alignment }))} disabled={!editable} onClick={() => run((instance) => instance.chain().setTextAlign(alignment).run())}>
            <Icon className="h-3.5 w-3.5" />
          </ToolbarButton>
        ))}
      </div>
      {linkOpen ? (
        <div
          id={linkPanelId}
          ref={linkPanelRef}
          role="dialog"
          aria-label="Nastavitve povezave"
          data-product-description-link-panel
          className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">URL povezave</span>
            <input
              ref={linkInputRef}
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-800 outline-none focus:border-sky-500"
            />
          </label>
          <button type="button" onClick={applyLink} className="h-8 rounded-md bg-sky-600 px-3 text-[10px] font-semibold text-white">Uporabi</button>
          <button type="button" onClick={closeLinkPanelAndRestoreFocus} className="h-8 rounded-md border border-slate-300 px-3 text-[10px] font-semibold text-slate-600">Prekliči</button>
        </div>
      ) : null}
      <div
        ref={hostRef}
        data-appearance-editor-scroll-purpose="content"
        className="max-h-64 min-h-32 overflow-y-auto bg-white text-slate-800 [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none [&_.ProseMirror_a]:text-sky-600 [&_.ProseMirror_a]:underline [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_h2]:mb-1 [&_.ProseMirror_h2]:mt-2 [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-bold [&_.ProseMirror_hr]:my-3 [&_.ProseMirror_li]:ml-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_ul]:list-disc"
      />
    </div>
  );
}
