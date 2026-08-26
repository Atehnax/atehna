import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const navigationEditorSource = readFileSync(
  resolve(process.cwd(), 'src/admin/features/podoba/components/AdminNavigationPageClient.tsx'),
  'utf8'
);

test('footer alignment uses one compact accessible contextual radiogroup', () => {
  const helperStart = navigationEditorSource.indexOf('function FooterTextAlignmentMenu');
  const helperEnd = navigationEditorSource.indexOf('function TopLevelNavItemEditor', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const helperSource = navigationEditorSource.slice(helperStart, helperEnd);

  assert.match(helperSource, /useDropdownDismiss\(\{ open, refs: dismissRefs, onClose: \(\) => setOpen\(false\) \}\)/u);
  assert.match(helperSource, /aria-haspopup="dialog"/u);
  assert.match(helperSource, /aria-expanded=\{open\}/u);
  assert.match(helperSource, /event\.key !== 'Escape'/u);
  assert.match(helperSource, /triggerRef\.current\?\.focus\(\)/u);
  assert.match(helperSource, /data-footer-text-alignment-popover/u);
  assert.match(helperSource, /bg-slate-950\/95/u);
  assert.match(helperSource, /AppearanceEditorAlignmentControl/u);
  assert.doesNotMatch(helperSource, /overflow(?:-[xy])?-(?:auto|scroll)/u);
});

test('every persisted footer text scope is bound to its contextual control and live preview style', () => {
  for (const binding of [
    'config.footer.descriptionTextAlign',
    'column.titleTextAlign',
    'link.textAlign',
    'config.footer.contact.textAlign',
    'config.footer.copyrightTextAlign'
  ]) {
    assert.ok(navigationEditorSource.includes(binding), `Missing footer alignment binding: ${binding}`);
  }

  assert.match(navigationEditorSource, /onValueChange=\{\(descriptionTextAlign\) => updateFooter\(\{ descriptionTextAlign \}\)\}/u);
  assert.match(navigationEditorSource, /onValueChange=\{\(titleTextAlign\) => onChange\(\{ titleTextAlign \}\)\}/u);
  assert.match(navigationEditorSource, /onValueChange=\{\(textAlign\) => onChange\(\{ textAlign \}\)\}/u);
  assert.match(navigationEditorSource, /onValueChange=\{\(textAlign\) => updateFooterContact\(\{ textAlign \}\)\}/u);
  assert.match(navigationEditorSource, /onValueChange=\{\(copyrightTextAlign\) => updateFooter\(\{ copyrightTextAlign \}\)\}/u);
  assert.match(navigationEditorSource, /const footerTextAlignmentOptions = \['left', 'center', 'right', 'justify'\] as const/u);
  assert.match(navigationEditorSource, /const footerShortTextAlignmentOptions = \['left', 'center', 'right'\] as const/u);
  assert.match(navigationEditorSource, /<SiteFooter[\s\S]*?settings=\{config\.footer\}/u);
});

test('inline editing and newly created footer content preserve alignment', () => {
  assert.match(navigationEditorSource, /className=\{`\$\{compactInputClassName\}[\s\S]*?style=\{style\}/u);
  assert.match(navigationEditorSource, /title: 'Nov stolpec',[\s\S]*?titleTextAlign: 'left'/u);
  assert.match(navigationEditorSource, /label: 'Nova povezava',[\s\S]*?textAlign: 'left'/u);
  assert.match(navigationEditorSource, /label: 'Nova pravna povezava',[\s\S]*?textAlign: 'left'/u);
});
