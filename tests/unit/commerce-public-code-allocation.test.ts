import { execFileSync } from 'node:child_process';
import test from 'node:test';

// Match the existing server-module test pattern. Crypto mocks are confined to
// the child process and the actual implementation retains its server-only guard.
function runServerAssertions(assertions: string): void {
  execFileSync(process.execPath, [
    '--conditions=react-server', '--import', 'tsx', '--input-type=module', '--eval',
    String.raw`
      import assert from 'node:assert/strict';
      import crypto from 'node:crypto';
      import { syncBuiltinESMExports } from 'node:module';
      import { mock } from 'node:test';
      ${assertions}
    `
  ], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15_000, windowsHide: true
  });
}

test('secure public-code generator returns the exact allowed base format', () => {
  runServerAssertions(String.raw`
    const { generateCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    for (let index = 0; index < 64; index += 1) {
      assert.match(generateCommercePublicCodeBase(), /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{16}$/u);
    }
  `);
});

test('secure public-code generator rejects biased bytes and draws another crypto chunk', () => {
  runServerAssertions(String.raw`
    const chunks = [
      Buffer.from(Array.from({ length: 16 }, (_, index) => 240 + index)),
      Buffer.from([0, 29, 30, 59, 60, 89, 90, 119, 120, 149, 150, 179, 180, 209, 210, 239])
    ];
    const requestedSizes = [];
    mock.method(crypto, 'randomBytes', (size) => {
      requestedSizes.push(size);
      assert.ok(chunks.length > 0, 'Unexpected additional entropy request');
      return chunks.shift();
    });
    syncBuiltinESMExports();
    const { generateCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    assert.equal(generateCommercePublicCodeBase(), '2Z2Z2Z2Z2Z2Z2Z2Z');
    assert.deepEqual(requestedSizes, [16, 16]);
    assert.equal(chunks.length, 0);
  `);
});

test('public-code allocation returns the inserted row and its base without retrying', () => {
  runServerAssertions(String.raw`
    const { insertWithGeneratedCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    const row = { id: 42 };
    const attemptedBases = [];
    const allocated = await insertWithGeneratedCommercePublicCodeBase(async (base) => {
      attemptedBases.push(base);
      return { rows: [row] };
    });
    assert.equal(attemptedBases.length, 1);
    assert.equal(allocated.row, row);
    assert.equal(allocated.publicCodeBase, attemptedBases[0]);
  `);
});

test('public-code allocation draws a fresh base after each suppressed collision', () => {
  runServerAssertions(String.raw`
    let entropyCalls = 0;
    mock.method(crypto, 'randomBytes', (size) => Buffer.alloc(size, entropyCalls++));
    syncBuiltinESMExports();
    const { insertWithGeneratedCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    const attemptedBases = [];
    const row = { id: 42 };
    const allocated = await insertWithGeneratedCommercePublicCodeBase(async (base) => {
      attemptedBases.push(base);
      return { rows: attemptedBases.length < 3 ? [] : [row] };
    });
    assert.deepEqual(attemptedBases, ['2'.repeat(16), '3'.repeat(16), '4'.repeat(16)]);
    assert.equal(entropyCalls, 3);
    assert.equal(allocated.publicCodeBase, '4'.repeat(16));
    assert.equal(allocated.row, row);
  `);
});

test('public-code allocation fails after its bounded default or explicit attempt limit', () => {
  runServerAssertions(String.raw`
    const { insertWithGeneratedCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    for (const maximumAttempts of [undefined, 2]) {
      let insertCalls = 0;
      await assert.rejects(
        insertWithGeneratedCommercePublicCodeBase(async () => {
          insertCalls += 1;
          return { rows: [] };
        }, maximumAttempts),
        /unique commerce public code could not be allocated/u
      );
      assert.equal(insertCalls, maximumAttempts ?? 5);
    }
  `);
});

test('public-code allocation propagates database errors instead of treating them as collisions', () => {
  runServerAssertions(String.raw`
    const { insertWithGeneratedCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    const databaseError = new Error('Connection lost');
    let insertCalls = 0;
    await assert.rejects(
      insertWithGeneratedCommercePublicCodeBase(async () => {
        insertCalls += 1;
        throw databaseError;
      }),
      (error) => error === databaseError
    );
    assert.equal(insertCalls, 1);
  `);
});

test('public-code allocation propagates entropy errors before attempting insertion', () => {
  runServerAssertions(String.raw`
    const entropyError = new Error('Entropy source unavailable');
    let entropyCalls = 0;
    mock.method(crypto, 'randomBytes', () => {
      entropyCalls += 1;
      throw entropyError;
    });
    syncBuiltinESMExports();
    const { insertWithGeneratedCommercePublicCodeBase } =
      await import('./src/shared/server/commercePublicCode.ts');
    let insertCalls = 0;
    await assert.rejects(
      insertWithGeneratedCommercePublicCodeBase(async () => {
        insertCalls += 1;
        return { rows: [{ id: 42 }] };
      }),
      (error) => error === entropyError
    );
    assert.equal(entropyCalls, 1);
    assert.equal(insertCalls, 0);
  `);
});
