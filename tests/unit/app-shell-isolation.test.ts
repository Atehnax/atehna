import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const commercialRouteAdapters = [
  'page.tsx',
  'about/page.tsx',
  'cart/page.tsx',
  'contact/page.tsx',
  'cookies/page.tsx',
  'how-schools-order/page.tsx',
  'offer/review/page.tsx',
  'order/page.tsx',
  'order/confirmation/page.tsx',
  'order/narocilnica/page.tsx',
  'privacy/page.tsx',
  'products/page.tsx',
  'products/[category]/page.tsx',
  'products/[category]/items/[item]/page.tsx',
  'products/[category]/[subcategory]/page.tsx',
  'products/[category]/[subcategory]/[item]/page.tsx',
  'quote/offer/page.tsx',
  'quote-request/confirmation/page.tsx',
  'terms/page.tsx'
] as const;

test('public route URLs remain owned by one persistent commercial route group', () => {
  const layout = source('src/app/(commercial)/layout.tsx');
  assert.match(layout, /commercial\/shell\/rootLayout/u);

  for (const route of commercialRouteAdapters) {
    assert.equal(
      existsSync(resolve(process.cwd(), 'src/app/(commercial)', route)),
      true,
      route
    );

    assert.equal(
      existsSync(resolve(process.cwd(), 'src/app', route)),
      false,
      route
    );
  }
});

test('the application root no longer initializes the storefront for admin routes', () => {
  const rootLayout = source('src/app/layout.tsx');
  assert.doesNotMatch(rootLayout, /commercial\/shell\/rootLayout/u);
  assert.doesNotMatch(rootLayout, /get(?:Site|Global|Product|Inventory)/u);
  assert.match(
    rootLayout,
    /className="flex min-h-screen flex-col bg-slate-50 text-slate-900"/u
  );
});

test('admin routes preserve their shell geometry with reduced storefront work', () => {
  const adminShell = source('src/admin/shell/rootLayout.tsx');
  const routeHeader = source('src/admin/components/AdminRouteHeader.tsx');

  assert.match(adminShell, /getSiteNavigationConfig\(\)/u);
  assert.match(adminShell, /getSiteLogoConfig\(\)/u);
  assert.doesNotMatch(adminShell, /getGlobalStyleConfig/u);
  assert.doesNotMatch(adminShell, /getProductAppearanceConfig/u);
  assert.doesNotMatch(adminShell, /getInventoryPolicySettings/u);
  assert.match(adminShell, /className="site-page-surface flex-1"/u);

  assert.match(
    routeHeader,
    /className="h-\[65px\] border-b border-\[#e5e5e5\] bg-white"/u
  );
  assert.match(
    routeHeader,
    /pathname !== '\/admin\/podoba\/navigacija'/u
  );
  assert.match(
    routeHeader,
    /dynamic\(\s*\(\) => import\('@\/commercial\/components\/SiteHeader'\)/u
  );
});

test('the admin product preview loads only its required inventory policy', () => {
  const page = source('src/admin/pages/podoba/artikli/page.tsx');
  const client = source(
    'src/admin/features/podoba/components/AdminProductAppearancePageClient.tsx'
  );

  assert.match(page, /getInventoryPolicySettings\(\)/u);
  assert.match(
    page,
    /initialStockEnforcementEnabled=\{inventoryPolicy\.stockEnforcementEnabled\}/u
  );
  assert.match(client, /<StorefrontInventoryPolicyProvider/u);
  assert.match(
    client,
    /stockEnforcementEnabled=\{initialStockEnforcementEnabled\}/u
  );
});
