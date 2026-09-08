import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(resolve('src/admin/components/adminSessionActivity.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const flush = () => new Promise<void>((done) => setImmediate(done));

function setup({ postStatus = 200, getStatus = 200, fetchResponse }: {
  postStatus?: number; getStatus?: number;
  fetchResponse?: (url: string, init: RequestInit, now: number) => Response | Promise<Response>;
} = {}) {
  let now = Date.parse('2026-09-08T10:00:00Z');
  let timerId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const documentListeners = new Map<string, (event: { isTrusted: boolean }) => void>();
  const windowListeners = new Map<string, () => void>();
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const redirects: string[] = [];
  const document = {
    visibilityState: 'visible',
    addEventListener: (type: string, listener: (event: { isTrusted: boolean }) => void) => documentListeners.set(type, listener),
    removeEventListener: (type: string) => documentListeners.delete(type)
  };
  const exports: { startAdminSessionActivityTracking?: () => () => void; ADMIN_SESSION_CHANGED_EVENT?: string } = {};
  runInNewContext(compiled, {
    exports, AbortController,
    Date: class extends Date { static now() { return now; } },
    document,
    window: {
      location: { replace: (url: string) => redirects.push(url) },
      addEventListener: (type: string, listener: () => void) => windowListeners.set(type, listener),
      removeEventListener: (type: string) => windowListeners.delete(type)
    },
    setTimeout: (callback: () => void, delay: number) => { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
    fetch: async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      if (fetchResponse) return fetchResponse(url, init, now);
      return Response.json({ expiresAt: new Date(now + 60_000).toISOString() }, { status: init.method === 'POST' ? postStatus : getStatus });
    }
  });
  return {
    start: () => exports.startAdminSessionActivityTracking!(), requests, redirects, timers, document,
    emit: (type: string, isTrusted = true) => documentListeners.get(type)?.({ isTrusted }),
    policyChanged: () => windowListeners.get(exports.ADMIN_SESSION_CHANGED_EVENT!)?.(),
    advance: (milliseconds: number) => { now += milliseconds; },
    fireDueTimers: () => { for (const [id, timer] of [...timers]) { if (timer.at <= now) { timers.delete(id); timer.callback(); } } },
    registeredEvents: () => [...documentListeners.keys()],
    posts: () => requests.filter((request) => request.init.method === 'POST')
  };
}

test('session activity sends only for trusted input in a visible page and obeys the 30 second throttle', async () => {
  const app = setup(); const stop = app.start(); await flush();
  assert.deepEqual(app.registeredEvents(), ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input']);
  app.emit('pointerdown', false);
  app.document.visibilityState = 'hidden'; app.emit('keydown');
  app.document.visibilityState = 'visible'; app.emit('focus'); app.emit('visibilitychange');
  assert.equal(app.posts().length, 0);
  app.emit('pointerdown'); await flush();
  assert.equal(app.posts().length, 1);
  assert.equal(app.posts()[0].url, '/api/admin/session/activity');
  assert.deepEqual(JSON.parse(app.posts()[0].init.body as string), {});
  assert.equal((app.posts()[0].init.headers as Record<string, string>)['X-Admin-Activity'], '1');
  app.advance(29_999); app.emit('input'); app.emit('wheel');
  assert.equal(app.posts().length, 1);
  app.advance(1); app.emit('keydown'); await flush();
  assert.equal(app.posts().length, 2);
  stop();
});

test('timers and settings refreshes only read session state and never flush trailing activity', async () => {
  const app = setup(); const stop = app.start(); await flush();
  app.emit('touchstart'); await flush();
  app.advance(10_000); app.emit('input');
  app.advance(50_000); app.fireDueTimers(); await flush();
  assert.equal(app.posts().length, 1);
  assert.equal(app.requests.filter((request) => request.url === '/api/admin/session').length, 2);
  app.policyChanged(); await flush();
  assert.equal(app.posts().length, 1);
  assert.equal(app.requests.filter((request) => request.url === '/api/admin/session').length, 3);
  stop();
});

test('expired sessions redirect once and tracker cleanup cancels listeners and outstanding expiry work', async () => {
  const app = setup({ postStatus: 401 }); const stop = app.start(); await flush();
  app.emit('pointerdown'); await flush();
  assert.deepEqual(app.redirects, ['/admin']);
  app.advance(30_000); app.emit('keydown');
  assert.equal(app.posts().length, 1);
  stop(); assert.equal(app.timers.size, 0); assert.equal(app.registeredEvents().length, 0);
  assert.ok(app.requests.every((request) => request.init.signal?.aborted));
  app.advance(60_000); app.emit('input'); app.policyChanged(); app.fireDueTimers(); await flush();
  assert.equal(app.posts().length, 1);
});

test('an already expired session is redirected by the initial read without any activity POST', async () => {
  const app = setup({ getStatus: 401 }); const stop = app.start(); await flush();
  assert.deepEqual(app.redirects, ['/admin']); assert.equal(app.posts().length, 0); stop();
});


test('a delayed initial read cannot overwrite a newer confirmed activity deadline', async () => {
  let resolveInitial!: (response: Response) => void;
  const initialRead = new Promise<Response>((resolve) => { resolveInitial = resolve; });
  const start = Date.parse('2026-09-08T10:00:00Z');
  const app = setup({ fetchResponse: (_url, init, now) => init.method === 'POST'
    ? Response.json({ expiresAt: new Date(now + 120_000).toISOString() }) : initialRead });
  const stop = app.start();
  app.emit('pointerdown'); await flush();
  app.advance(61_000);
  resolveInitial(Response.json({ expiresAt: new Date(start + 60_000).toISOString() })); await flush();
  assert.deepEqual(app.redirects, []);
  assert.equal(app.requests.length, 2);
  assert.equal([...app.timers.values()][0].at, start + 120_000);
  stop();
});

test('an elapsed deadline in a delayed initial response is confirmed with a readonly request', async () => {
  let resolveInitial!: (response: Response) => void;
  const initialRead = new Promise<Response>((resolve) => { resolveInitial = resolve; });
  let reads = 0;
  const start = Date.parse('2026-09-08T10:00:00Z');
  const app = setup({ fetchResponse: (_url, _init, now) => ++reads === 1
    ? initialRead : Response.json({ expiresAt: new Date(now + 60_000).toISOString() }) });
  const stop = app.start();
  app.advance(61_000);
  resolveInitial(Response.json({ expiresAt: new Date(start + 60_000).toISOString() })); await flush();
  assert.deepEqual(app.redirects, []);
  assert.equal(app.requests.length, 2);
  assert.equal(app.posts().length, 0);
  stop();
});
