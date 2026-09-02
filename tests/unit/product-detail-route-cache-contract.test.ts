import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('product detail App Router entrypoint opts out of full-route 404 caching', () => {
  const entrypointSource = readFileSync(
    resolve(
      process.cwd(),
      'src/app/(commercial)/products/[category]/items/[item]/page.tsx'
    ),
    'utf8'
  );

  assert.match(
    entrypointSource,
    /^\s*export\s+const\s+dynamic\s*=\s*(['"])force-dynamic\1\s*;?\s*$/mu,
    'The actual src/app entrypoint must declare force-dynamic locally so Next does not retain a full-route 404 after publication.'
  );
});
