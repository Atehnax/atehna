import assert from 'node:assert/strict';
import test from 'node:test';
import { readAnalyticsJson } from '../../src/shared/client/readAnalyticsJson';

const fallback = 'Analitika trenutno ni na voljo.';

test('analytics reader accepts a JSON object with charset and vendor JSON media types', async () => {
  const payload = { asOf: '2026-09-06T12:00:00Z', days: [], total: 0 };
  for (const contentType of ['application/json; charset=utf-8', 'Application/JSON', 'application/vnd.atehna+json']) {
    const response = new Response(JSON.stringify(payload), { headers: { 'content-type': contentType } });
    assert.deepEqual(await readAnalyticsJson(response, fallback), payload);
  }
});

test('analytics reader preserves a structured API error message', async () => {
  const response = Response.json({ message: 'Izbrano obdobje ni veljavno.' }, { status: 400 });
  await assert.rejects(readAnalyticsJson(response, fallback), { message: 'Izbrano obdobje ni veljavno.' });
});

test('401 always explains session expiry for JSON or HTML without displaying the body', async () => {
  for (const contentType of ['application/json', 'text/html']) {
    const response = new Response('<html>private login details</html>', { status: 401, headers: { 'content-type': contentType } });
    await assert.rejects(readAnalyticsJson(response, fallback), {
      message: 'Prijava je potekla. Za nadaljevanje se ponovno prijavite.'
    });
    assert.equal(response.bodyUsed, false);
  }
});

test('404 HTML produces a contextual HTTP error without parsing or exposing the page', async () => {
  const response = new Response('<!DOCTYPE html><h1>Private framework detail</h1>', { status: 404, headers: { 'content-type': 'text/html' } });
  await assert.rejects(readAnalyticsJson(response, fallback), { message: 'Analitika trenutno ni na voljo (HTTP 404).' });
  assert.equal(response.bodyUsed, false);
});

test('a followed 200 HTML page is not mistaken for a successful analytics object', async () => {
  const response = new Response('<html>Login or platform error page</html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(readAnalyticsJson(response, fallback), {
    message: 'Analitika trenutno ni na voljo. Strežnik je vrnil neveljaven odgovor (HTTP 200).'
  });
});

test('malformed declared JSON never exposes a native parser message or HTML', async () => {
  for (const body of ['<!DOCTYPE html><h1>Internal failure</h1>', '{"days":', '']) {
    const response = new Response(body, { headers: { 'content-type': 'application/json' } });
    await assert.rejects(readAnalyticsJson(response, fallback), {
      message: 'Analitika trenutno ni na voljo. Strežnik je vrnil neveljaven odgovor (HTTP 200).'
    });
  }
});

test('non-object JSON successes fail instead of reaching analytics rendering', async () => {
  for (const payload of [null, [], 42, true, 'private response detail']) {
    await assert.rejects(readAnalyticsJson(Response.json(payload), fallback), {
      message: 'Analitika trenutno ni na voljo. Strežnik je vrnil neveljaven odgovor (HTTP 200).'
    });
  }
});

test('unknown or HTML-shaped structured errors use the safe contextual fallback', async () => {
  for (const payload of [{}, { message: { detail: 'private' } }, { message: '  ' }, { message: '<html>private failure</html>' }]) {
    await assert.rejects(readAnalyticsJson(Response.json(payload, { status: 503 }), fallback), {
      message: 'Analitika trenutno ni na voljo (HTTP 503).'
    });
  }
});

test('403 HTML remains an HTTP failure rather than claiming session expiry', async () => {
  const response = new Response('<html>Platform challenge</html>', { status: 403, headers: { 'content-type': 'text/html' } });
  await assert.rejects(readAnalyticsJson(response, fallback), { message: 'Analitika trenutno ni na voljo (HTTP 403).' });
});

test('AbortError during response reading is rethrown unchanged', async () => {
  const aborted = new DOMException('The operation was aborted.', 'AbortError');
  const response = {
    ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => { throw aborted; }
  };
  await assert.rejects(readAnalyticsJson(response, fallback), error => error === aborted);
});
