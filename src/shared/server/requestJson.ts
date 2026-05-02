import 'server-only';

import { NextResponse } from 'next/server';

export type JsonRecord = Record<string, unknown>;

type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readRequiredJsonRecord(
  request: Request,
  message = 'Neveljaven JSON.'
): Promise<JsonBodyResult<JsonRecord>> {
  try {
    const body: unknown = await request.json();
    if (isJsonRecord(body)) return { ok: true, body };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message }, { status: 400 })
    };
  }

  return {
    ok: false,
    response: NextResponse.json({ message }, { status: 400 })
  };
}
