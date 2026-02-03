import { NextResponse } from 'next/server';
import { query } from '@/lib/server/db';

export async function GET() {
  try {
    await query('select 1');
    return NextResponse.json({
      ok: true,
      blobTokenPresent: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        blobTokenPresent: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
      },
      { status: 500 }
    );
  }
}
