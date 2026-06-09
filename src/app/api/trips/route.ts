import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { requireAuthenticatedUser } from '@/lib/session';
import { createTrip } from '@/lib/trips';

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const trip = await createTrip(prisma, {
      tripDateRaw: body.trip_date ?? body.tripDate,
      origin: body.origin,
      destination: body.destination,
      businessPurpose: body.business_purpose ?? body.businessPurpose,
      milesRaw: String(body.miles ?? ''),
      categoryIdRaw: String(body.category_id ?? body.categoryId ?? ''),
      vehicleIdRaw: String(body.vehicle_id ?? body.vehicleId ?? ''),
      odometerStartRaw: body.odometer_start ?? body.odometerStart,
      odometerEndRaw: body.odometer_end ?? body.odometerEnd,
    });
    return NextResponse.json({ ok: true, id: trip.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
