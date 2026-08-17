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

test('generated customer share URLs put the bootstrap secret in a fragment', async () => {
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
  assert.match(
    checkoutRouteSource,
    /confirmationUrl:\s*buildOrderConfirmationAccessUrl\(token\)/u
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
      new NextRequest(`https://storefront.example${pathname}?access=public-id`)
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

test('legacy query tokens redirect to a fragment before a sensitive page renders', () => {
  const syntheticToken = 'synthetic-legacy-marker';

  for (const pathname of ['/order/confirmation', '/order/narocilnica']) {
    const response = proxy(
      new NextRequest(
        `https://storefront.example${pathname}?campaign=receipt&token=${syntheticToken}`
      )
    );
    const location = response.headers.get('location');

    assert.equal(response.status, 307);
    assert.ok(location, 'legacy token requests must redirect before rendering');
    const redirectUrl = new URL(location);
    assert.equal(redirectUrl.pathname, pathname);
    assert.equal(redirectUrl.search, '?campaign=receipt');
    assert.equal(redirectUrl.hash, `#token=${syntheticToken}`);
    assert.ok(!redirectUrl.searchParams.has('token'));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(
      response.headers.get('x-robots-tag'),
      'noindex, nofollow, noarchive'
    );
  }
});
