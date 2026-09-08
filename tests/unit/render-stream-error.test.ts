import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { Instrumentation } from 'next';
import { renderStreamErrorEvent, reportRenderStreamError } from '../../src/shared/server/diagnostics/renderStreamError';

type Request = Parameters<Instrumentation.onRequestError>[1];
type Context = Parameters<Instrumentation.onRequestError>[2];
const message = 'The destination stream closed early.';
const request: Request = { path: '/admin/orders/123?token=private-token', method: 'GET', headers: { cookie: 'private-cookie', authorization: 'Bearer private-auth', 'x-vercel-id': 'fra1::iad1::request-synthetic-42', 'x-request-id': 'private-client-id' } };
const context: Context = { routerKind: 'App Router', routePath: '/admin/orders/[orderId]/page', routeType: 'render', renderSource: 'server-rendering', revalidateReason: undefined };
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

test('captures the exact stream warning with source route and hashed platform request correlation', () => {
  const error = Object.assign(new Error(message), { digest: '3267730335' });
  const event = renderStreamErrorEvent(error, request, context);
  assert.ok(event);
  assert.equal(event.event, 'render_destination_stream_closed');
  assert.equal(event.routeTemplate, context.routePath);
  assert.equal(event.renderSource, 'server-rendering');
  assert.equal(event.platformRequestIdSha256, sha(String(request.headers['x-vercel-id'])));
  assert.equal(event.digest, '3267730335');
  assert.equal(event.stackSha256, sha(error.stack!));
  assert.match(event.eventId, /^[0-9a-f-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(event.recordedAt)));
});

test('does not collect unrelated errors or match digest alone', () => {
  for (const error of [null, undefined, message, new Error('Other failure'), { message: 'Other failure', digest: '3267730335' }]) {
    assert.equal(renderStreamErrorEvent(error, request, context), null);
  }
});

test('never emits raw request values, error stack, arbitrary cause or custom properties', () => {
  const error = { message, digest: 'private-digest', stack: 'private-stack /users/person@example.test', cause: 'private-cause', customer: 'private-customer' };
  const serialized = JSON.stringify(renderStreamErrorEvent(error, request, context));
  for (const secret of ['private-token','private-cookie','private-auth','private-client-id','private-digest','private-stack','person@example.test','private-cause','private-customer','/admin/orders/123',String(request.headers['x-vercel-id'])]) assert.equal(serialized.includes(secret), false, secret);
});

test('request correlation stays stable for the same platform request and differs for another request', () => {
  const error = new Error(message);
  const first = renderStreamErrorEvent(error, request, context)!;
  const second = renderStreamErrorEvent(error, request, context)!;
  const different = renderStreamErrorEvent(error, { ...request, headers: { 'x-vercel-id': 'fra1::iad1::request-synthetic-43' } }, context)!;
  assert.equal(first.platformRequestIdSha256, second.platformRequestIdSha256);
  assert.notEqual(first.eventId, second.eventId);
  assert.notEqual(first.platformRequestIdSha256, different.platformRequestIdSha256);
});

test('missing, multiple or oversized platform IDs remain explicitly unavailable', () => {
  for (const headers of [{}, { 'x-vercel-id': ['one','two'] }, { 'x-vercel-id': 'a'.repeat(257) }, { 'x-vercel-id': '' }]) {
    assert.equal(renderStreamErrorEvent(new Error(message), { ...request, headers }, context)!.platformRequestIdSha256, null);
  }
});

test('rejects unsafe route templates and unexpected framework enum values', () => {
  const unsafe = { ...context, routePath: '/orders?email=person@example.test', routerKind: 'private-router', routeType: 'private-type', renderSource: 'private-source', revalidateReason: 'private-reason' } as unknown as Context;
  const event = renderStreamErrorEvent(new Error(message), { ...request, method: 'private-method' }, unsafe)!;
  for (const key of ['routeTemplate','method','routerKind','routeType','renderSource','revalidateReason'] as const) assert.equal(event[key], null);
  assert.equal(renderStreamErrorEvent(new Error(message), request, { ...context, routePath: '/' + 'a'.repeat(181) })!.routeTemplate, null);
});

test('emits one JSON line for the warning and leaves the original error unchanged', () => {
  const error = Object.assign(new Error(message), { digest: '3267730335' });
  const before = Object.getOwnPropertyDescriptors(error);
  const lines: string[] = [];
  reportRenderStreamError(error, request, context, line => lines.push(line));
  reportRenderStreamError(new Error('Unrelated'), request, context, line => lines.push(line));
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).event, 'render_destination_stream_closed');
  assert.deepEqual(Object.getOwnPropertyDescriptors(error), before);
});

test('telemetry failures and hostile caught values cannot change request handling', () => {
  assert.doesNotThrow(() => reportRenderStreamError(new Error(message), request, context, () => { throw Error('Sink failed'); }));
  assert.doesNotThrow(() => reportRenderStreamError({ get message() { throw Error('Getter failed'); } }, request, context));
});
