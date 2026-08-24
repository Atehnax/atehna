import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { NextRequest } from 'next/server';
import { config as proxyConfig, proxy } from '../../src/proxy';

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

test('only generated admin share URLs expose a fragment bootstrap secret', async () => {
  const orderAccessSource = await readFile(
    resolve(process.cwd(), 'src/shared/server/orderAccess.ts'),
    'utf8'
  );
  const checkoutRouteSource = await readFile(
    resolve(process.cwd(), 'src/commercial/api/orders/route.ts'),
    'utf8'
  );
  const adminAccessRouteSource = await readFile(
    resolve(
      process.cwd(),
      'src/admin/api/orders/[orderId]/access-token/route.ts'
    ),
    'utf8'
  );

  assert.match(
    orderAccessSource,
    /return `\/order\/confirmation#token=\$\{encodeURIComponent\(token\.trim\(\)\)\}`;/u
  );
  assert.doesNotMatch(orderAccessSource, /\/order\/confirmation\?token=/u);
  assert.doesNotMatch(
    checkoutRouteSource,
    /buildOrderConfirmationAccessUrl|confirmationToken|confirmationUrl:/u,
    'initial order responses must not expose a bootstrap bearer'
  );
  assert.match(
    checkoutRouteSource,
    /setOrderAccessSessionCookie\(nextResponse, session\)/u
  );
  assert.match(
    adminAccessRouteSource,
    /confirmationUrl:\s*buildOrderConfirmationAccessUrl\(issued\.token\)/u
  );
});

test('the confirmation API accepts only an access-id-bound HttpOnly session', async () => {
  const confirmationRouteSource = await readFile(
    resolve(
      process.cwd(),
      'src/commercial/api/orders/confirmation/route.ts'
    ),
    'utf8'
  );

  assert.match(
    confirmationRouteSource,
    /request\.headers\.has\('x-order-access-id'\)/u
  );
  assert.match(
    confirmationRouteSource,
    /const session = readOrderAccessSession\(request\);/u
  );
  assert.match(
    confirmationRouteSource,
    /access\?\.tokenId\.toLowerCase\(\) === session\.accessId/u
  );
  assert.doesNotMatch(
    confirmationRouteSource,
    /searchParams\.get\(['"]token['"]\)/u,
    'the confirmation API must never accept a bearer secret from the request URL'
  );
});

test('customer order pages accept credentials only from a fragment or established session', async () => {
  const [
    orderAccessClientSource,
    checkoutPageSource,
    confirmationPageSource,
    purchaseOrderUploadSource
  ] = await Promise.all([
    readFile(
      resolve(process.cwd(), 'src/commercial/order/orderAccessClient.ts'),
      'utf8'
    ),
    readFile(
      resolve(
        process.cwd(),
        'src/commercial/order/components/OrderPageClient.tsx'
      ),
      'utf8'
    ),
    readFile(
      resolve(
        process.cwd(),
        'src/commercial/order/components/OrderConfirmationPageClient.tsx'
      ),
      'utf8'
    ),
    readFile(
      resolve(
        process.cwd(),
        'src/commercial/order/components/PurchaseOrderUploadForm.tsx'
      ),
      'utf8'
    )
  ]);

  assert.match(
    orderAccessClientSource,
    /fragmentParams\.get\('token'\)/u
  );
  assert.doesNotMatch(
    orderAccessClientSource,
    /searchParams\.get\(['"](?:token|access)['"]\)|consumeOrderAccessIdFromLocation/u,
    'query credentials must not be parsed into a client session'
  );
  assert.doesNotMatch(
    orderAccessClientSource,
    /legacyQueryToken|legacyQueryAccess/u
  );
  assert.match(checkoutPageSource, /storeOrderAccessId\(accessId\);/u);
  assert.match(
    checkoutPageSource,
    /window\.location\.replace\('\/order\/confirmation'\);/u
  );
  assert.doesNotMatch(
    checkoutPageSource,
    /exchangeOrderAccessToken|buildOrderConfirmationFragmentUrl|confirmationToken|confirmationUrl/u
  );
  assert.doesNotMatch(
    confirmationPageSource,
    /consumeOrderAccessIdFromLocation|searchParams\.get\(['"]access['"]\)/u
  );
  assert.match(
    confirmationPageSource,
    /readStoredOrderAccessId\(\)/u
  );
  assert.doesNotMatch(
    purchaseOrderUploadSource,
    /consumeOrderAccessIdFromLocation|searchParams\.get\(['"]access['"]\)/u
  );
  assert.match(purchaseOrderUploadSource, /readStoredOrderAccessId\(\)/u);
});

test('purchase-order uploads require the access-id-bound session and reject bearer fallback', async () => {
  const [uploadRouteSource, orderAccessSource] = await Promise.all([
    readFile(
      resolve(process.cwd(), 'src/commercial/api/orders/purchase-order/route.ts'),
      'utf8'
    ),
    readFile(resolve(process.cwd(), 'src/shared/server/orderAccess.ts'), 'utf8')
  ]);

  assert.match(uploadRouteSource, /readOrderAccessSession\(request\)/u);
  assert.match(
    uploadRouteSource,
    /verifyOrderAccessToken\([\s\S]*?session\.token,[\s\S]*?'purchase_order'[\s\S]*?!access\s*\|\|\s*access\.tokenId\.toLowerCase\(\) !== session\.accessId/u
  );
  assert.doesNotMatch(
    uploadRouteSource,
    /x-order-access-id|readBearerToken|authorization/u,
    'the upload route must derive its selector and credential only from the HttpOnly session'
  );
  assert.doesNotMatch(orderAccessSource, /export function readBearerToken/u);
});

test('document access batches every valid order session without an arbitrary cookie cap', async () => {
  const orderAccessSource = await readFile(
    resolve(process.cwd(), 'src/shared/server/orderAccess.ts'),
    'utf8'
  );
  const verifierStart = orderAccessSource.indexOf(
    'export async function verifyOrderAccessSessionForOrder'
  );
  const verifierEnd = orderAccessSource.indexOf(
    'export function buildOrderConfirmationAccessUrl',
    verifierStart
  );
  const verifierSource = orderAccessSource.slice(verifierStart, verifierEnd);

  assert.ok(verifierStart >= 0 && verifierEnd > verifierStart);
  assert.doesNotMatch(
    verifierSource,
    /candidates\.size\s*>?=\s*\d+|for \(const \[accessId, token\] of candidates\)/u
  );
  assert.match(
    verifierSource,
    /unnest\(\$1::text\[\], \$2::uuid\[\]\)[\s\S]*?with ordinality/u
  );
  assert.match(
    verifierSource,
    /access\.token_hash = candidate\.token_hash[\s\S]*?access\.id = candidate\.access_id/u
  );
  assert.match(
    verifierSource,
    /access\.order_id = \$3[\s\S]*?\$4 = any\(access\.scopes\)[\s\S]*?update order_access_tokens/u
  );
});

test('sensitive customer order pages send non-caching privacy headers', async () => {
  const configModuleUrl = pathToFileURL(
    resolve(process.cwd(), 'next.config.mjs')
  ).href;
  const configModule = (await import(configModuleUrl)) as {
    default: { headers?: () => Promise<HeaderRule[]> };
  };
  const rules: HeaderRule[] = (await configModule.default.headers?.()) ?? [];

  assert.ok(rules.length > 0, 'next.config.mjs must configure response headers');
  for (const source of ['/order/confirmation', '/order/narocilnica']) {
    const rule: HeaderRule | undefined = rules.find(
      (candidate: HeaderRule) => candidate.source === source
    );
    assert.ok(rule, `${source} must have a dedicated response-header rule`);
    assert.deepEqual(
      Object.fromEntries(
        rule.headers.map((header: { key: string; value: string }) => [
          header.key.toLowerCase(),
          header.value
        ])
      ),
      {
        'cache-control': 'private, no-store',
        'referrer-policy': 'no-referrer',
        'x-robots-tag': 'noindex, nofollow, noarchive'
      }
    );
  }
});

test('the request proxy enforces sensitive page headers without dropping admin matchers', () => {
  for (const pathname of ['/order/confirmation', '/order/narocilnica']) {
    const response = proxy(
      new NextRequest(`https://storefront.example${pathname}`)
    );

    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      response.headers.get('x-robots-tag'),
      'noindex, nofollow, noarchive'
    );
  }

  assert.deepEqual(proxyConfig.matcher, [
    '/admin/:path*',
    '/api/admin/:path*',
    '/order/confirmation',
    '/order/narocilnica'
  ]);
});

test('the request proxy scrubs unsupported query credentials without bootstrapping them', () => {
  const credentials = [
    ['token', 'synthetic-query-token'],
    ['access', '123e4567-e89b-42d3-a456-426614174099']
  ] as const;

  for (const pathname of ['/order/confirmation', '/order/narocilnica']) {
    for (const [name, value] of credentials) {
      const response = proxy(
        new NextRequest(
          `https://storefront.example${pathname}?campaign=receipt&${name}=${value}`
        )
      );
      const location = response.headers.get('location');

      assert.equal(response.status, 307);
      assert.ok(location, 'query credentials must be removed before rendering');
      const redirectUrl = new URL(location);
      assert.equal(redirectUrl.pathname, pathname);
      assert.equal(redirectUrl.search, '?campaign=receipt');
      assert.equal(redirectUrl.hash, '');
      assert.ok(!redirectUrl.searchParams.has('token'));
      assert.ok(!redirectUrl.searchParams.has('access'));
      assert.ok(!location.includes(value));
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(
        response.headers.get('x-robots-tag'),
        'noindex, nofollow, noarchive'
      );
    }
  }
});
