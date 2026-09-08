# Render stream warning diagnostics

`src/instrumentation.ts` uses Next.js's documented Node runtime `onRequestError` hook. It adds one JSON console event only when the caught message exactly equals `The destination stream closed early.`. The framework keeps reporting its original error normally. This code does not suppress warnings or attempt a rendering fix.

The event includes an event UUID, UTC timestamp, framework source route template, allowlisted method/router/render context, numeric React digest and SHA-256 of the stack. It never reads `request.path`, and never emits query parameters, raw request headers, cookies, authorization values, raw error stack, error cause or custom error properties. It performs no database or network operation. Logging failure cannot fail the request.

`platformRequestIdSha256` hashes the optional `x-vercel-id` header. The platform's request-log association is the primary correlation context. The hash can compare two captured values after applying SHA-256; it is not the provider's directly searchable request ID. If the header is missing, repeated or oversized the field is null. The generated event UUID identifies the diagnostic event, not an independently verified browser request. The hook does not expose response finish/close timing, pending-work count or client cancellation state.

A separate production Next.js 16.3.1 fixture held a server-side fetch behind a loopback gate. Cancelling an actual RSC HTTP response while the gate was pending produced the real destination-close warning and this hook's event with `renderSource: react-server-components-payload`. Completed HTML and RSC controls produced neither. The framework's normal error line remained present, followed by one structured diagnostic. A separate deliberately thrown matching error verified registration and was not counted as a natural stream-close reproduction.

This establishes relevant hook coverage, not the cause of the original application incident. The fixture used webpack, while the original application warning was observed in the Turbopack production build. The new warning's digest also differs from the original. A future recurrence must still be assessed with its own request outcome and platform context. Normal cancelled requests can be filtered as AbortError by Next.js and need not emit this event.

Focused tests cover exact matching, exclusion of private values, hashed correlation, missing-header behavior, unsafe metadata, unrelated errors, unchanged original errors and logging failures. No telemetry service, retention job or automation is added.
