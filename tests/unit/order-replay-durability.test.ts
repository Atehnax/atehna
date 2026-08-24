import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

test('idempotent replay returns the same encrypted bootstrap only while it remains active', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const cipherSource = source(
    'src/shared/server/orderAccessBootstrapCipher.ts'
  );
  const schemaSource = source('database/schema.sql');
  const replayStart = routeSource.indexOf("if (reservation.kind === 'replay')");
  const replayEnd = routeSource.indexOf('const quote =', replayStart);
  const replaySource = routeSource.slice(replayStart, replayEnd);

  assert.ok(replayStart >= 0 && replayEnd > replayStart);
  assert.match(
    replaySource,
    /decryptOrderAccessBootstrap\([\s\S]*?reservation\.encryptedBootstrap[\s\S]*?keyHash[\s\S]*?reservation\.orderId/u
  );
  assert.match(
    replaySource,
    /verifyOrderAccessToken\([\s\S]*?accessToken[\s\S]*?'confirmation'[\s\S]*?reservation\.orderId/u,
    'replay must reject an expired, revoked, or wrong-order bootstrap token'
  );
  assert.match(
    replaySource,
    /createCustomerOrderResponse\([\s\S]*?tokenId: verifiedAccess\.tokenId[\s\S]*?token: accessToken[\s\S]*?expiresAt: verifiedAccess\.expiresAt[\s\S]*?200/u
  );
  assert.doesNotMatch(replaySource, /confirmationToken|confirmationUrl:/u);
  assert.doesNotMatch(replaySource, /issueOrderAccessToken|revokeOrderAccessTokens/u);

  assert.match(cipherSource, /createCipheriv\('aes-256-gcm'/u);
  assert.match(cipherSource, /randomBytes\(12\)/u);
  assert.match(cipherSource, /cipher\.setAAD\(additionalAuthenticatedData\(keyHash, orderId\)\)/u);
  assert.match(cipherSource, /secret\.length < MINIMUM_KEY_CHARACTERS/u);
  assert.match(cipherSource, /MINIMUM_KEY_CHARACTERS = 32/u);

  assert.match(
    schemaSource,
    /bootstrap_token_ciphertext text[\s\S]*?bootstrap_token_iv text[\s\S]*?bootstrap_token_tag text/u
  );
  assert.match(
    schemaSource,
    /create unique index idx_order_access_tokens_one_unrevoked[\s\S]*?where revoked_at is null/u,
    'the schema must retain the one-active-token invariant'
  );
});

test('the idempotency receipt stores ciphertext but never a plaintext bootstrap token', () => {
  const routeSource = source('src/commercial/api/orders/route.ts');
  const storedResponse = routeSource.match(
    /type StoredOrderResponse = \{([\s\S]*?)\n\};/u
  );

  assert.ok(storedResponse);
  assert.doesNotMatch(storedResponse[1], /token|confirmationUrl/u);
  assert.match(
    routeSource,
    /encryptOrderAccessBootstrap\([\s\S]*?accessToken\.token[\s\S]*?keyHash[\s\S]*?inserted\.orderId/u
  );
  assert.match(
    routeSource,
    /bootstrap_token_ciphertext = \$3[\s\S]*?bootstrap_token_iv = \$4[\s\S]*?bootstrap_token_tag = \$5/u
  );
  assert.doesNotMatch(
    routeSource,
    /response_json\s*=\s*[^\n]*accessToken\.token/u
  );
});

test('bootstrap encryption key requirements are explicit for local and Vercel configuration', () => {
  const environmentTemplate = source('.env.example');
  const readme = source('README.md');

  assert.match(environmentTemplate, /^ORDER_ACCESS_BOOTSTRAP_KEY=.+$/mu);
  assert.match(readme, /`ORDER_ACCESS_BOOTSTRAP_KEY` is required/u);
  assert.match(readme, /Sensitive Vercel environment/u);
  assert.match(readme, /at\s+least 32 random characters/u);
  assert.match(readme, /Rotating this key intentionally/u);
});
