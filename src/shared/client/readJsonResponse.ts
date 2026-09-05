export function readJsonResponse<TFallback>(
  response: Pick<Response, 'json'>,
  fallback: TFallback
): Promise<unknown | TFallback> {
  const parsed: Promise<unknown> = response.json();
  return parsed.catch(() => fallback);
}
