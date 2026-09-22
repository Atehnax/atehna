import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderDocumentPreviewRuntimeLoader } from '../../src/admin/features/urejevalnik/lib/orderDocumentPreviewRuntime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('preloading and overlapping document renders share one ready PDF worker', async () => {
  const imported = deferred<{ name: string }>();
  const ready = deferred<void>();
  let imports = 0;
  let workers = 0;
  const worker = { promise: ready.promise, destroy() { assert.fail('a shared worker must survive documents'); } };
  const load = createOrderDocumentPreviewRuntimeLoader(
    () => { imports += 1; return imported.promise; },
    () => { workers += 1; return worker; }
  );
  const preload = load();
  const firstDocument = load();
  assert.equal(firstDocument, preload, 'startup should not duplicate worker downloads');
  assert.equal(imports, 1);
  imported.resolve({ name: 'PDF.js' });
  await Promise.resolve();
  assert.equal(workers, 1);
  let available = false;
  void preload.then(() => { available = true; });
  await Promise.resolve();
  assert.equal(available, false, 'rendering waits until the worker is actually ready');
  ready.resolve();
  const runtime = await firstDocument;
  assert.equal(runtime.worker, worker);
  assert.equal(await load(), runtime, 'later documents reuse the ready worker');
  assert.equal(workers, 1);
});

test('a failed PDF library preload can be retried by the actual document render', async () => {
  let attempts = 0;
  const load = createOrderDocumentPreviewRuntimeLoader(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('chunk unavailable');
      return { name: 'PDF.js' };
    },
    () => ({ promise: Promise.resolve(), destroy() {} })
  );
  await assert.rejects(load(), /chunk unavailable/);
  assert.equal((await load()).module.name, 'PDF.js');
  assert.equal(attempts, 2);
});

test('failed worker startup is released and the next preview creates a fresh worker', async () => {
  let attempts = 0;
  let destroyed = 0;
  const load = createOrderDocumentPreviewRuntimeLoader(
    async () => ({ name: 'PDF.js' }),
    () => {
      attempts += 1;
      return {
        promise: attempts === 1 ? Promise.reject(new Error('worker unavailable')) : Promise.resolve(),
        destroy() { destroyed += 1; }
      };
    }
  );
  await assert.rejects(load(), /worker unavailable/);
  const runtime = await load();
  assert.ok(runtime.worker);
  assert.equal(attempts, 2);
  assert.equal(destroyed, 1, 'only the failed worker should be destroyed');
  assert.equal(await load(), runtime);
});

test('installed PDF.js keeps the shared worker alive while releasing each real PDF document', async () => {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.create();
  source.addPage([595, 842]);
  const bytes = await source.save();
  let workerStarts = 0;
  const load = createOrderDocumentPreviewRuntimeLoader(
    () => import('pdfjs-dist/legacy/build/pdf.mjs'),
    (pdfjs) => { workerStarts += 1; return new pdfjs.PDFWorker(); }
  );
  const runtime = await load();
  try {
    for (let index = 0; index < 3; index += 1) {
      const { module: pdfjs, worker } = await load();
      const task = pdfjs.getDocument({ data: bytes.slice(), worker });
      try {
        const pdf = await task.promise;
        assert.equal(pdf.numPages, 1);
        assert.deepEqual(await pdf.getData(), bytes, 'worker transfer preserves the downloadable PDF');
        const page = await pdf.getPage(1);
        assert.equal(page.getViewport({ scale: 2 }).width, 1190);
      } finally {
        await task.destroy();
      }
      assert.equal(worker.destroyed, false, 'document cleanup must not terminate the next preview worker');
    }
    assert.equal(workerStarts, 1);
  } finally {
    runtime.worker.destroy();
  }
});

const flushDisposal = () => new Promise<void>((resolve) => { setImmediate(resolve); });

test('editor unmount waits for an aborted render to finish document cleanup', async () => {
  let destroyed = 0;
  const load = createOrderDocumentPreviewRuntimeLoader(
    async () => ({}),
    () => ({ promise: Promise.resolve(), destroy() { destroyed += 1; } })
  );
  const releaseEditor = load.retain();
  const releaseRender = load.retain();
  await load();
  const cleanup = deferred<void>();
  const renderFinished = cleanup.promise.finally(releaseRender);
  releaseEditor();
  await flushDisposal();
  assert.equal(destroyed, 0, 'the render still needs its worker to acknowledge task.destroy()');
  cleanup.resolve();
  await renderFinished;
  await flushDisposal();
  assert.equal(destroyed, 1);
  releaseEditor();
  releaseRender();
  await flushDisposal();
  assert.equal(destroyed, 1, 'effect and render cleanup are idempotent');
});

test('StrictMode cleanup and immediate remount reuse the worker, then navigation releases it', async () => {
  let starts = 0;
  let destroyed = 0;
  const load = createOrderDocumentPreviewRuntimeLoader(
    async () => ({}),
    () => {
      starts += 1;
      return { promise: Promise.resolve(), destroy() { destroyed += 1; } };
    }
  );
  const releaseInitialEffect = load.retain();
  const original = await load();
  releaseInitialEffect();
  const releaseRemountedEffect = load.retain();
  await flushDisposal();
  assert.equal(destroyed, 0);
  assert.equal(await load(), original);
  assert.equal(starts, 1);
  releaseRemountedEffect();
  await flushDisposal();
  assert.equal(destroyed, 1, 'leaving the editor releases its idle worker');

  const releaseNextVisit = load.retain();
  assert.notEqual(await load(), original);
  assert.equal(starts, 2);
  releaseNextVisit();
  await flushDisposal();
  assert.equal(destroyed, 2);
});

test('a retired pending startup cannot destroy a later mount worker', async () => {
  const firstImport = deferred<{ id: number }>();
  let imports = 0;
  const destroyed: number[] = [];
  const load = createOrderDocumentPreviewRuntimeLoader(
    () => {
      imports += 1;
      return imports === 1 ? firstImport.promise : Promise.resolve({ id: imports });
    },
    ({ id }) => ({ promise: Promise.resolve(), destroy() { destroyed.push(id); } })
  );
  const releaseFirstMount = load.retain();
  const retiring = load();
  releaseFirstMount();
  await flushDisposal();
  const releaseSecondMount = load.retain();
  const current = await load();
  firstImport.resolve({ id: 1 });
  await retiring;
  await flushDisposal();
  assert.deepEqual(destroyed, [1]);
  assert.equal(await load(), current, 'retired completion must not clear the current runtime');
  releaseSecondMount();
  await flushDisposal();
  assert.deepEqual(destroyed, [1, 2]);
});

test('installed PDF.js accepts a new document while a previous loading task is cancelled', { timeout: 5_000 }, async () => {
  const { PDFDocument } = await import('pdf-lib');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const source = await PDFDocument.create();
  source.addPage([595, 842]);
  const bytes = await source.save();
  const worker = new pdfjs.PDFWorker();
  await worker.promise;
  try {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const cancelled = pdfjs.getDocument({ data: bytes.slice(), worker });
      const previousSettled = cancelled.promise.then(() => undefined, () => undefined);
      if (attempt % 2) await Promise.resolve();
      // Do not await either startup or cancellation before the replacement request.
      const cancelling = cancelled.destroy();
      const replacement = pdfjs.getDocument({ data: bytes.slice(), worker });
      try {
        const pdf = await replacement.promise;
        assert.equal(pdf.numPages, 1);
        assert.deepEqual(await pdf.getData(), bytes);
        await Promise.all([cancelling, previousSettled]);
        assert.equal(worker.destroyed, false);
      } finally {
        await replacement.destroy();
      }
    }
  } finally {
    worker.destroy();
  }
});
