import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { hasValidAdminSession } from '@/shared/auth/adminSession';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import {
  getInventoryPolicySettings,
  InventoryPolicySchemaNotReadyError,
  InventoryPolicyValidationError,
  updateInventoryPolicySettings
} from '@/shared/server/inventoryPolicy';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';

export const dynamic = 'force-dynamic';

function authorize(request: Request): NextResponse | null {
  if (!hasValidAdminSession(request)) {
    return NextResponse.json(
      { message: 'Za dostop je potrebna prijava.' },
      { status: 401 }
    );
  }
  return null;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    return NextResponse.json({ config: await getInventoryPolicySettings() });
  } catch (error) {
    console.error('Failed to load inventory policy settings', error);
    return NextResponse.json(
      { message: 'Nastavitev zaloge trenutno ni mogoče naložiti.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const result = await updateInventoryPolicySettings(
      body.body.config ?? body.body,
      { request }
    );
    if (result.changed) {
      revalidatePath('/admin/artikli');
      revalidatePath('/', 'layout');
      revalidatePath('/order');
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    if (error instanceof InventoryPolicyValidationError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof InventoryPolicySchemaNotReadyError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    console.error('Failed to update inventory policy settings', error);
    return NextResponse.json(
      { message: 'Shranjevanje nastavitve zaloge ni uspelo.' },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
