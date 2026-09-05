import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonResponse } from '../../src/shared/client/readJsonResponse';

test('readJsonResponse returns valid JSON', async () => {
  const payload = await readJsonResponse(
    new Response('{"ok":true,"count":2}'),
    {}
  );

  assert.deepEqual(payload, { ok: true, count: 2 });
});

test('readJsonResponse returns the supplied fallback for malformed or empty bodies', async () => {
  for (const body of ['{', '']) {
    const fallback = {};
    const payload = await readJsonResponse(new Response(body), fallback);

    assert.strictEqual(payload, fallback);
  }
});

test('readJsonResponse preserves a valid null payload', async () => {
  const payload = await readJsonResponse(new Response('null'), {});

  assert.strictEqual(payload, null);
});

test('readJsonResponse reads the response body exactly once', async () => {
  let reads = 0;
  const response: Pick<Response, 'json'> = {
    json: async () => {
      reads += 1;
      return { ok: true };
    }
  };

  assert.deepEqual(await readJsonResponse(response, {}), { ok: true });
  assert.equal(reads, 1);
});
