import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { ShippingConfiguration } from '@/shared/domain/shipping/shipping';
import { isDatabaseUnavailableError } from '@/shared/server/db';
import { readRequiredJsonRecord } from '@/shared/server/requestJson';
import {
  getShippingAdminState,
  ShippingConfigurationConflictError,
  ShippingConfigurationValidationError,
  updateShippingConfiguration
} from '@/shared/server/shipping';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ state: await getShippingAdminState() });
  } catch (error) {
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev poštnine ni mogoče naložiti, ker baza ni dosegljiva.'
          : 'Nastavitev poštnine trenutno ni mogoče naložiti.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await readRequiredJsonRecord(request);
    if (!body.ok) return body.response;
    const configuration = body.body.configuration as ShippingConfiguration | undefined;
    const expectedVersion = Number(body.body.expectedVersion);
    const expectedRevision = Number(body.body.expectedRevision);
    if (!configuration) {
      return NextResponse.json(
        { message: 'Manjka konfiguracija poštnine.' },
        { status: 400 }
      );
    }
    const result = await updateShippingConfiguration(configuration, expectedVersion, {
      request,
      expectedRevision
    });
    revalidatePath('/admin/postnina');
    return NextResponse.json({ state: result });
  } catch (error) {
    if (error instanceof ShippingConfigurationConflictError) {
      return NextResponse.json(
        {
          code: 'SHIPPING_CONFIGURATION_CHANGED',
          message: error.message,
          configuration: error.currentConfiguration
        },
        { status: 409 }
      );
    }
    if (error instanceof ShippingConfigurationValidationError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        message: isDatabaseUnavailableError(error)
          ? 'Nastavitev ni mogoče shraniti, ker baza ni dosegljiva.'
          : 'Shranjevanje nastavitev poštnine ni uspelo.'
      },
      { status: isDatabaseUnavailableError(error) ? 503 : 500 }
    );
  }
}
