import { NextResponse } from 'next/server';
import { getPool } from '@/shared/server/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get('orderId');
  if (orderId && !/^\d{1,19}$/.test(orderId)) return NextResponse.json({ message: 'Neveljaven ID naročila.' }, { status: 400 });
  try {
    const result = await (await getPool()).query(
      `select id::text, order_id::text, action, actor, reason, created_at,
       coalesce(previous_json->>'municipality_id', previous_json->>'municipalityId') as previous_municipality_id,
       coalesce(previous_json->>'region_id', previous_json->>'regionId') as previous_region_id,
       next_json->>'municipalityId' as municipality_id, next_json->>'regionId' as region_id,
       next_json->>'sourceVersion' as source_version
       from order_geography_audit where ($1::bigint is null or order_id = $1) order by id desc limit 100`, [orderId]);
    return NextResponse.json({ audit: result.rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Geography audit failed', error);
    return NextResponse.json({ message: 'Revizijska sled trenutno ni na voljo.' }, { status: 503 });
  }
}
