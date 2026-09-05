import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const preview = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/email/components/EmailMessagePreview.tsx',
  ),
  'utf8',
);
const workspace = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/email/components/EmailTemplateWorkspace.tsx',
  ),
  'utf8',
);
const contextToolbar = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/email/components/EmailTemplateContextToolbar.tsx',
  ),
  'utf8',
);
const richTextEditor = readFileSync(
  resolve(process.cwd(), 'src/admin/components/AdminRichTextEditor.tsx'),
  'utf8',
);
const toolbarPrimitives = readFileSync(
  resolve(
    process.cwd(),
    'src/admin/features/podoba/components/AppearanceEditorToolbarPrimitives.tsx',
  ),
  'utf8',
);

test('workspace email previews expose a generic opt-in editor overlay contract', () => {
  assert.ok(preview.includes('editor?: EmailMessagePreviewEditor;'));
  assert.ok(preview.includes('selectedBlockId: string | null;'));
  assert.ok(preview.includes('blockLabels: Readonly<Record<string, string>>;'));
  assert.ok(preview.includes('onSelectBlock: (blockId: string | null) => void;'));
  assert.ok(preview.includes('toolbar: ReactNode;'));
  assert.ok(preview.includes('const editorEnabled = workspace && editor !== undefined;'));

  assert.ok(
    preview.includes('.querySelectorAll<HTMLElement>("[data-email-editor-id]")'),
  );
  assert.ok(preview.includes('data-canvas-element-id={blockId}'));
  assert.ok(preview.includes('data-canvas-element-selected={selected ? "true" : undefined}'));
  assert.ok(preview.includes('aria-label='));
  assert.ok(preview.includes('Uredi'));
  assert.ok(preview.includes('aria-pressed={selected}'));
  assert.ok(preview.includes('event.key !== "Enter" && event.key !== " "'));
  assert.ok(preview.includes('adminEditorSelectionOutlineTokenClasses'));
  assert.ok(preview.includes('renderEditorTarget('));
  assert.ok(preview.includes('"subject"'));
});

test('workspace email editor overlays track layout and use the shared floating toolbar safely', () => {
  assert.ok(preview.includes('const scaleX = frameRect.width / frameViewportWidth;'));
  assert.ok(preview.includes('const scaleY = frameRect.height / frameViewportHeight;'));
  assert.ok(preview.includes('new ResizeObserver(scheduleEditorBlockMeasurement)'));
  assert.ok(preview.includes('new MutationObserver(scheduleEditorBlockMeasurement)'));
  assert.ok(preview.includes('window.addEventListener("resize", scheduleEditorBlockMeasurement)'));
  assert.ok(preview.includes('window.addEventListener("scroll", scheduleEditorBlockMeasurement, true)'));
  assert.ok(preview.includes('window.visualViewport?.addEventListener("resize", scheduleEditorBlockMeasurement)'));
  assert.ok(preview.includes('window.visualViewport?.addEventListener("scroll", scheduleEditorBlockMeasurement)'));
  assert.ok(preview.includes('<FloatingAppearanceEditorContextToolbar'));
  assert.ok(preview.includes('anchorId={editor.selectedBlockId}'));
  assert.ok(preview.includes('onDismiss={dismissEditorSelection}'));
  assert.ok(preview.includes('currentEditor.onSelectBlock?.(null);'));
  assert.ok(preview.includes('currentEditor.selectedBlockId === selectedBlockId'));

  assert.ok(preview.includes('sandbox="allow-same-origin"'));
  assert.ok(preview.includes('srcDoc={isolatedHtml}'));
  assert.doesNotMatch(preview, /allow-scripts/u);
  assert.match(
    toolbarPrimitives,
    /data-appearance-editor-compact-select-portal[^'\n]*\[role="dialog"\]/u,
  );
});

test('interactive template workspace keeps editing contextual and the rich-text toolbar compact', () => {
  assert.match(workspace, /const \[selectedBlockId, setSelectedBlockId\] = useState/u);
  assert.match(workspace, /editor=\{\{[\s\S]*?selectedBlockId[\s\S]*?toolbar:/u);
  assert.match(workspace, /<EmailTemplateContextToolbar/u);
  assert.match(workspace, /sharedContent=\{sharedContent\}/u);
  assert.match(workspace, /systemLines=\{editor\.systemLines\}/u);
  assert.doesNotMatch(workspace, /<Input|<AdminRichTextEditor/u);

  assert.match(contextToolbar, /toolbarVariant="compact"/u);
  assert.match(contextToolbar, /heightClassName="h-\[18rem\] min-h-\[16rem\]"/u);
  assert.match(contextToolbar, /adminControlFocusTokenClasses/u);
  assert.doesNotMatch(contextToolbar, /focus:ring-1 focus:ring-blue-300\/30/u);
  assert.match(contextToolbar, /Splošni navpični razmik/u);
  assert.match(contextToolbar, /Zmanjšaj razmik pred \$\{spacingTargetLabel\}/u);
  assert.match(contextToolbar, /Povečaj razmik pred \$\{spacingTargetLabel\}/u);
  assert.match(contextToolbar, /Skupna slikovna priponka/u);

  assert.match(richTextEditor, /toolbarVariant\?: 'full' \| 'compact'/u);
  assert.match(richTextEditor, /toolbarVariant = 'full'/u);
  assert.match(richTextEditor, /const compactToolbar = toolbarVariant === 'compact'/u);
  assert.match(richTextEditor, /allowImages && !compactToolbar/u);
});
