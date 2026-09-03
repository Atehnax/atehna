'use client';

import { Editor, Extension, type Extensions } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from 'react';
import { createPortal } from 'react-dom';
import { CompactHexColorField } from '@/shared/ui/admin-controls/CompactHexColorField';
import { adminNumberInputClassName } from '@/shared/ui/admin-controls/adminCompactFieldStyles';
import { Button } from '@/shared/ui/button';
import { Dialog, dialogActionButtonClassName, dialogFooterClassName } from '@/shared/ui/dialog';
import { useDropdownDismiss } from '@/shared/ui/dropdown/use-dropdown-dismiss';
import { MenuItem, MenuPanel } from '@/shared/ui/menu';

const inputClassName =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,color] focus:border-[#3e67d6] focus:ring-0';

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

function AdminRichTextColorPopover({
  open,
  anchorRef,
  color,
  onChange,
  onClose
}: {
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  color: string;
  onChange: (nextColor: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dismissRefs = useMemo(() => [anchorRef, panelRef], [anchorRef]);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setPosition({ top, left });
  }, [anchorRef]);

  useDropdownDismiss({
    open,
    refs: dismissRefs,
    ignoreSelector: '[data-admin-color-palette-portal]',
    ignoreEscapeSelector: '[data-admin-color-palette-portal]',
    onClose
  });

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const onWindowChange = () => updatePosition();

    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [open, updatePosition]);

  if (!open || !position || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100] w-[248px] rounded-md border border-slate-300 bg-white p-2 shadow-lg"
      style={position}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <CompactHexColorField
        label="Barva besedila"
        value={color}
        marker="admin-rich-text-color"
        tone="light"
        onChange={onChange}
        inputAttributes={{ 'aria-label': 'Barva besedila HEX' }}
        className="w-full"
      />
    </div>,
    document.body
  );
}

export type AdminRichTextEditorProps = {
  id?: string;
  value: string;
  editable?: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  testId?: string;
  ariaLabel?: string;
  allowImages?: boolean;
};

export default function AdminRichTextEditor({
  id,
  value,
  editable = true,
  onChange,
  placeholder = 'Opis artikla...',
  maxLength = 5000,
  testId,
  ariaLabel = 'Obogateno besedilo',
  allowImages = true
}: AdminRichTextEditorProps) {
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
  const closeRichTextMenu = useCallback(() => setOpenMenu(null), []);
  const richTextMenuDismissRefs = useMemo(
    () => [toolbarRef, sizeMenuRef, fontMenuRef],
    []
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorHostRef.current) return;
    const FontSize = Extension.create({
      name: 'fontSize',
      addGlobalAttributes() {
        return [{
          types: ['textStyle'],
          attributes: {
            fontSize: {
              default: null,
              parseHTML: (element: HTMLElement) => element.style.fontSize || null,
              renderHTML: (attributes: { fontSize?: string | null }) =>
                attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
            }
          }
        }];
      }
    });
    const extensions: Extensions = [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextStyle,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Color,
      FontFamily,
      TiptapLink.configure({ openOnClick: false, defaultProtocol: 'https' }),
      ...(allowImages ? [TiptapImage] : []),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder })
    ];

    const editor = new Editor({
      element: editorHostRef.current,
      editable,
      extensions,
      content: initialContentRef.current,
      editorProps: {
        attributes: {
          ...(id ? { id } : {}),
          'aria-label': ariaLabel,
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
  }, [allowImages, ariaLabel, editable, id, placeholder]);

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

  const positionMenuForTrigger = useCallback((
    menu: 'size' | 'font' | 'color',
    trigger: HTMLElement | null
  ) => {
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedWidth = menu === 'size' ? 100 : menu === 'font' ? 135 : 228;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - estimatedWidth - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 8);
    setMenuPosition({ top, left });
  }, []);

  useDropdownDismiss({
    open: openMenu === 'size' || openMenu === 'font',
    refs: richTextMenuDismissRefs,
    onClose: closeRichTextMenu
  });

  useEffect(() => {
    if (!openMenu) return;
    updateMenuPosition();
    const onWindowChange = () => updateMenuPosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [openMenu, updateMenuPosition]);

  const run = (action: (editor: Editor) => void, options?: { focusEditor?: boolean }) => {
    const editor = editorRef.current;
    if (!editor || !editable) return;
    action(editor);
    if (options?.focusEditor ?? true) editor.commands.focus();
  };
  const applyFontSize = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    run(
      (editor) => editor.chain().setMark('textStyle', { fontSize: `${parsed}px` }).run(),
      { focusEditor: false }
    );
  };
  const applyColor = (nextColor: string) => {
    const normalized = nextColor.trim();
    if (!normalized) return;
    setCustomColor(normalized);
    run((editor) => editor.chain().setColor(normalized).run(), { focusEditor: false });
  };
  const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const applyListWithLineSplit = (ordered: boolean) => {
    run((editor) => {
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, '\n');
      const lines = selected.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
        const chain = editor.chain().focus().deleteRange({ from, to }).insertContent(html);
        if (ordered) chain.toggleOrderedList().run();
        else chain.toggleBulletList().run();
        return;
      }
      if (ordered) editor.chain().focus().toggleOrderedList().run();
      else editor.chain().focus().toggleBulletList().run();
    });
  };
  const submitMediaUrl = () => {
    const normalized = mediaUrlDraft.trim();
    if (!normalized) return;
    if (mediaDialogMode === 'link') {
      run((editor) => editor.chain().focus().setLink({ href: normalized }).run());
    }
    if (mediaDialogMode === 'image' && allowImages) {
      run((editor) => editor.chain().focus().setImage({ src: normalized }).run());
    }
    setMediaDialogMode(null);
    setMediaUrlDraft('https://');
  };
  const preventToolbarFocusLoss = (event: { preventDefault: () => void }) => event.preventDefault();
  const toolbarButtonClass = 'rounded p-1.5 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const divider = <span className="mx-1 h-6 w-px bg-slate-300" aria-hidden />;

  return (
    <div
      className={`relative flex h-[150px] min-h-[130px] resize-y flex-col overflow-hidden rounded-lg border border-slate-300 ${editable ? 'bg-white' : 'bg-[color:var(--field-locked-bg)]'}`}
      data-testid={testId}
    >
      <div ref={toolbarRef} className="flex flex-nowrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button type="button" title="Krepko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().toggleBold().run())} aria-label="Bold"><span className="inline-block w-4 text-center text-base font-bold leading-none">B</span></button>
        <button type="button" title="Ležeče" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().toggleItalic().run())} aria-label="Italic"><svg xmlns="http://www.w3.org/2000/svg" className="h-[14px] w-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg></button>
        <button type="button" title="Podčrtano" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().toggleUnderline().run())} aria-label="Underline"><span className="inline-block w-4 text-center text-base underline leading-none">U</span></button>
        {divider}
        <button type="button" title="Točkovni seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(false)} aria-label="Bullet list"><svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5.75A.75.75 0 1 1 4.5 5.75.75.75 0 0 1 3 5.75Zm0 4.25A.75.75 0 1 1 4.5 10 .75.75 0 0 1 3 10Zm0 4.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7 5h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Z" /></svg></button>
        <button type="button" title="Oštevilčen seznam" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => applyListWithLineSplit(true)} aria-label="Ordered list"><svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 5h1v4h-1V7.3l-.7.3L2.5 6.8 3.5 6.3V5Zm3.5 0h10v1.5H7V5Zm0 4.25h10v1.5H7v-1.5Zm0 4.25h10V15H7v-1.5Zm-3.5-.15a1.9 1.9 0 0 1 1.9 1.9c0 .42-.13.79-.43 1.12-.23.26-.56.48-1 .63H5.5V18H2.5v-1.08l1.32-1.1c.2-.17.34-.3.41-.4a.66.66 0 0 0 .12-.39.63.63 0 0 0-.2-.48.81.81 0 0 0-.54-.17c-.34 0-.67.11-.99.33L2 13.9a2.4 2.4 0 0 1 1.5-.55Z" /></svg></button>
        {divider}
        <div className="relative">
          <button ref={sizeTriggerRef} type="button" title="Velikost besedila" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'size' ? null : 'size'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Text size"><svg className="h-[17.6px] w-[17.6px]" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M21,9.08A1.13,1.13,0,0,0,19.86,8H4.62a1.1,1.1,0,1,0,0,2.19H11V27a1.09,1.09,0,0,0,2.17,0V10.19h6.69A1.14,1.14,0,0,0,21,9.08Z" /><path d="M30.67,15H21.15a1.1,1.1,0,1,0,0,2.19H25V26.5a1.09,1.09,0,0,0,2.17,0V17.23h3.54a1.1,1.1,0,1,0,0-2.19Z" /></svg></button>
          {openMenu === 'size' && editable && menuPosition ? createPortal(
            <MenuPanel ref={sizeMenuRef} className="fixed z-[90] w-[100px] p-2 shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
                <div className="grid grid-cols-[1.25fr_1fr] items-center overflow-hidden rounded-md border border-slate-300">
                  <input type="number" min={1} className={`h-8 w-full border-0 px-2 text-xs text-slate-700 outline-none focus:ring-0 ${adminNumberInputClassName}`} value={fontSizeValue} onChange={(event) => { setFontSizeValue(event.target.value); applyFontSize(event.target.value); }} placeholder="16" />
                  <span className="inline-flex h-8 items-center justify-center border-l border-slate-300 bg-slate-50 text-xs text-slate-500">px</span>
                </div>
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button ref={fontTriggerRef} type="button" title="Pisava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'font' ? null : 'font'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Font family"><svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor"><path d="m11.3 4.5 4.2 11h-2.1l-.8-2.4H8.2l-.8 2.4H5.3l4.2-11h1.8Zm.7 6.8-1.6-4.7-1.6 4.7H12Z" /></svg></button>
          {openMenu === 'font' && editable && menuPosition ? createPortal(
            <MenuPanel ref={fontMenuRef} className="fixed z-[90] w-[135px] shadow-lg" style={menuPosition}>
              <div onMouseDown={(event) => event.stopPropagation()}>
                {fontFamilyOptions.map((font) => (
                  <MenuItem key={font.value} className="h-8 text-[12px]" onClick={() => { run((editor) => editor.chain().focus().setFontFamily(font.value).run()); setOpenMenu(null); }}>
                    <span className="text-[12px]" style={{ fontFamily: font.value }}>{font.label}</span>
                  </MenuItem>
                ))}
              </div>
            </MenuPanel>,
            document.body
          ) : null}
        </div>
        <div className="relative">
          <button ref={colorTriggerRef} type="button" title="Barva besedila" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={(event) => { event.stopPropagation(); const next = openMenu === 'color' ? null : 'color'; if (next) positionMenuForTrigger(next, event.currentTarget); setOpenMenu(next); }} aria-label="Text color"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11 10 3 3"/><path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/><path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/></svg></button>
          <AdminRichTextColorPopover open={openMenu === 'color' && editable} anchorRef={colorTriggerRef} color={customColor} onChange={applyColor} onClose={() => setOpenMenu(null)} />
        </div>
        <button type="button" title="Označi besedilo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().toggleHighlight({ color: '#fde68a' }).run())} aria-label="Highlight"><svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg></button>
        <button type="button" title="Vodoravna črta" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().setHorizontalRule().run())} aria-label="Horizontal rule"><svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 9.25h14v1.5H3v-1.5Z" /></svg></button>
        {divider}
        <button type="button" title="Povezava" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => { if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return; } setMediaDialogMode('link'); setMediaUrlDraft('https://'); })} aria-label="Link"><svg className="h-[13.6px] w-[13.6px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></button>
        {allowImages ? <button type="button" title="Slika" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => { setMediaDialogMode('image'); setMediaUrlDraft('https://'); }} aria-label="Image"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button> : null}
        {divider}
        <button type="button" title="Poravnaj levo" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().setTextAlign('left').run())} aria-label="Align left"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/></svg></button>
        <button type="button" title="Poravnaj na sredino" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().setTextAlign('center').run())} aria-label="Align center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/></svg></button>
        <button type="button" title="Poravnaj desno" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().setTextAlign('right').run())} aria-label="Align right"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/></svg></button>
        <button type="button" title="Poravnaj obojestransko" className={toolbarButtonClass} disabled={!editable} onMouseDown={preventToolbarFocusLoss} onClick={() => run((editor) => editor.chain().focus().setTextAlign('justify').run())} aria-label="Align justify"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></svg></button>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={editorHostRef} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-hidden [&_.ProseMirror]:min-h-[112px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none [&_.ProseMirror]:prose [&_.ProseMirror]:max-w-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h3]:text-base [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_a]:text-[#1982bf] [&_.ProseMirror_a]:underline ${editable ? '[&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:prose-slate' : 'cursor-not-allowed [&_.ProseMirror]:bg-[color:var(--field-locked-bg)] [&_.ProseMirror]:text-slate-500 [&_.ProseMirror]:prose-slate'}`} />
        <div className={`pointer-events-none ml-auto px-4 pb-2 text-xs ${editable ? 'text-slate-400' : 'text-slate-500'}`}>{textLength} / {maxLength}</div>
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
          <div className={dialogFooterClassName}>
            <Button type="button" variant="default" size="toolbar" className={dialogActionButtonClassName} onClick={() => setMediaDialogMode(null)}>Prekliči</Button>
            <Button type="button" variant="primary" size="toolbar" className={dialogActionButtonClassName} onClick={submitMediaUrl}>Potrdi</Button>
          </div>
        )}
      >
        <div className="mt-2 space-y-1">
          <label className="text-xs text-slate-600">{mediaDialogMode === 'link' ? 'URL povezave' : 'URL slike'}</label>
          <input className={inputClassName} value={mediaUrlDraft} onChange={(event) => setMediaUrlDraft(event.target.value)} placeholder="https://" />
        </div>
      </Dialog>
    </div>
  );
}
