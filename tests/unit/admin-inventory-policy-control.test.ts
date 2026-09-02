import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relativePath: string) =>
  readFile(new URL('../../' + relativePath, import.meta.url), 'utf8');

test('admin articles exposes the global Zaloga policy above the item table', async () => {
  const [pageSource, controlSource] = await Promise.all([
    readSource('src/admin/pages/artikli/page.tsx'),
    readSource('src/admin/features/artikli/components/AdminInventoryPolicyControl.tsx')
  ]);

  assert.match(pageSource, /getInventoryPolicySettings\(\)/u);
  assert.match(
    pageSource,
    /<AdminInventoryPolicyControl[\s\S]*?<AdminItemsManagerLoader/u,
    'the policy control must render before the articles table'
  );
  assert.match(
    pageSource,
    /initialStockEnforcementEnabled=\{inventoryPolicy\.stockEnforcementEnabled\}/u
  );

  assert.match(controlSource, />\s*Zaloga\s*</u);
  assert.match(controlSource, /<AdminSwitch/u);
  assert.match(controlSource, /fetch\('\/api\/admin\/inventory-policy'/u);
  assert.match(controlSource, /method: 'PUT'/u);
  assert.match(controlSource, /config: \{ stockEnforcementEnabled: nextEnabled \}/u);
  assert.match(controlSource, /router\.refresh\(\)/u);
  assert.doesNotMatch(controlSource, />\s*(?:Vklopljeno|Izklopljeno)\s*</u);
});
