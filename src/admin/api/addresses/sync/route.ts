import { NextResponse } from 'next/server';
import { syncGursAddresses } from '@/shared/server/gursAddressSync';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(
    cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`
  );
}

async function handleSync(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Nedovoljen dostop.' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }

  try {
    const result = await syncGursAddresses();
    if (result.status === 'skipped') {
      return NextResponse.json(
        {
          success: false,
          message: 'Sinhronizacija naslovov že poteka.',
          ...result
        },
        {
          status: 409,
          headers: { 'Cache-Control': 'no-store' }
        }
      );
    }

    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GURS address synchronization failed.', error);
    return NextResponse.json(
      { message: 'Sinhronizacija naslovov ni uspela.' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
