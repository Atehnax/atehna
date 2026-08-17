import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  assertExactNextCacheTarget,
  removeGeneratedNextCache
} from '../e2e/global-teardown';

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

test('E2E teardown removes only the generated Next.js cache directory', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'atehna-e2e-cache-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  const cacheFile = join(root, '.next', 'cache', 'nested', 'entry.bin');
  const serverFile = join(root, '.next', 'server', 'app.js');
  const siblingFile = join(root, 'cache', 'keep.txt');
  await mkdir(join(root, '.next', 'cache', 'nested'), { recursive: true });
  await mkdir(join(root, '.next', 'server'), { recursive: true });
  await mkdir(join(root, 'cache'), { recursive: true });
  await Promise.all([
    writeFile(cacheFile, 'generated'),
    writeFile(serverFile, 'server'),
    writeFile(siblingFile, 'keep')
  ]);

  assert.equal(await removeGeneratedNextCache(root), true);
  assert.equal(await pathExists(join(root, '.next', 'cache')), false);
  assert.equal(await readFile(serverFile, 'utf8'), 'server');
  assert.equal(await readFile(siblingFile, 'utf8'), 'keep');
});

test('E2E teardown target guard rejects every path except project .next/cache', () => {
  const root = resolve('temporary-project-root');
  const exactTarget = resolve(root, '.next', 'cache');

  assert.equal(assertExactNextCacheTarget(root, exactTarget), exactTarget);
  for (const unsafeTarget of [
    root,
    resolve(root, '.next'),
    resolve(root, '.next', 'cache', 'nested'),
    resolve(root, 'cache'),
    resolve(root, '..', '.next', 'cache')
  ]) {
    assert.throws(
      () => assertExactNextCacheTarget(root, unsafeTarget),
      /Refusing to remove anything except the project \.next\/cache directory/u
    );
  }
});

test('E2E teardown is a no-op when the generated cache does not exist', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'atehna-e2e-no-cache-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  assert.equal(await removeGeneratedNextCache(root), false);
  assert.equal(await pathExists(root), true);
});
