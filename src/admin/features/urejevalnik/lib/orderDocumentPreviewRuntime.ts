type PreviewWorker = {
  promise: Promise<void>;
  destroy: () => void;
};

type PreviewRuntimeLoader<Module, Worker> = {
  (): Promise<{ module: Module; worker: Worker }>;
  retain: () => () => void;
};

/** Share startup and keep the worker alive until both editor and renders release it. */
export function createOrderDocumentPreviewRuntimeLoader<Module, Worker extends PreviewWorker>(
  loadModule: () => Promise<Module>,
  createWorker: (module: Module) => Worker
): PreviewRuntimeLoader<Module, Worker> {
  let runtime: Promise<{ module: Module; worker: Worker }> | undefined;
  let retainCount = 0;
  const load = () => {
    if (!runtime) {
      const pending = loadModule().then(async (module) => {
        const worker = createWorker(module);
        try {
          await worker.promise;
          return { module, worker };
        } catch (error) {
          worker.destroy();
          throw error;
        }
      });
      runtime = pending;
      void pending.catch(() => {
        if (runtime === pending) runtime = undefined;
      });
    }
    return runtime;
  };
  const retain = () => {
    retainCount += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      retainCount -= 1;
      const retiring = runtime;
      if (retainCount !== 0 || !retiring) return;
      // React StrictMode immediately remounts effects; let that mount retain it.
      queueMicrotask(() => {
        if (retainCount !== 0 || runtime !== retiring) return;
        runtime = undefined;
        // Capture the old startup so a later mount's worker cannot be terminated.
        void retiring.then(({ worker }) => worker.destroy()).catch(() => undefined);
      });
    };
  };
  return Object.assign(load, { retain });
}
