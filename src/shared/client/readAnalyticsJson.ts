type AnalyticsResponse = Pick<Response, 'ok' | 'status' | 'headers' | 'json'>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function responseFailure(response: AnalyticsResponse, message: string): Error {
  const context = message.trim().replace(/[.!?]+$/, '');
  return new Error(response.ok
    ? `${context}. Strežnik je vrnil neveljaven odgovor (HTTP ${response.status}).`
    : `${context} (HTTP ${response.status}).`);
}

/** Reads an analytics object without exposing HTML or native JSON parsing errors. */
export async function readAnalyticsJson<T extends object>(
  response: AnalyticsResponse,
  failureMessage: string
): Promise<T> {
  if (response.status === 401) {
    throw new Error('Prijava je potekla. Za nadaljevanje se ponovno prijavite.');
  }
  const mediaType = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim();
  if (!/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/i.test(mediaType)) {
    throw responseFailure(response, failureMessage);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    // A cancelled request must stay silent in the existing component effects.
    if (isObject(error) && error.name === 'AbortError') throw error;
    throw responseFailure(response, failureMessage);
  }

  if (!response.ok) {
    const message = isObject(payload) && typeof payload.message === 'string' ? payload.message.trim() : '';
    if (message && message.length <= 500 && !/[<>]/.test(message)) throw new Error(message);
    throw responseFailure(response, failureMessage);
  }
  if (!isObject(payload)) throw responseFailure(response, failureMessage);
  return payload as T;
}
