import { lstat, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

function cleanupError(message: string) {
  return new Error(`[e2e-teardown] ${message}`);
}

export function assertExactNextCacheTarget(
  rootDirectory: string,
  candidateDirectory: string
) {
  const resolvedRoot = resolve(rootDirectory);
  const expectedParent = resolve(resolvedRoot, '.next');
  const expectedTarget = resolve(expectedParent, 'cache');
  const resolvedTarget = resolve(candidateDirectory);

  if (
    resolvedTarget !== expectedTarget
    || relative(resolvedRoot, resolvedTarget) !== join('.next', 'cache')
    || dirname(resolvedTarget) !== expectedParent
    || basename(resolvedTarget) !== 'cache'
  ) {
    throw cleanupError(
      'Refusing to remove anything except the project .next/cache directory.'
    );
  }

  return resolvedTarget;
}

async function assertRealDirectoryOrMissing(
  directory: string,
  label: string
) {
  try {
    const stats = await lstat(directory);
    if (stats.isSymbolicLink()) {
      throw cleanupError(`Refusing to follow a symbolic link at ${label}.`);
    }
    if (!stats.isDirectory()) {
      throw cleanupError(`Refusing to remove ${label} because it is not a directory.`);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function removeGeneratedNextCache(
  rootDirectory = projectRoot
) {
  const resolvedRoot = resolve(rootDirectory);
  const nextDirectory = resolve(resolvedRoot, '.next');
  const cacheDirectory = assertExactNextCacheTarget(
    resolvedRoot,
    resolve(nextDirectory, 'cache')
  );

  if (!await assertRealDirectoryOrMissing(nextDirectory, '.next')) return false;
  if (!await assertRealDirectoryOrMissing(cacheDirectory, '.next/cache')) return false;

  await rm(cacheDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  });
  return true;
}

export default async function globalTeardown() {
  const removed = await removeGeneratedNextCache();
  if (removed) {
    console.info('[e2e-teardown] Removed the generated .next/cache directory.');
  }
}
