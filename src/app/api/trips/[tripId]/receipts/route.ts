import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { storeReceipt } from '@/lib/receipts';
import { requireAuthenticatedUser } from '@/lib/session';
import { getTrip } from '@/lib/trips';

interface RouteParams {
  params: { tripId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    await requireAuthenticatedUser();
    const tripId = parseInt(params.tripId, 10);
    if (Number.isNaN(tripId)) {
      return NextResponse.json({ error: 'Invalid trip id.' }, { status: 400 });
    }

    const trip = await getTrip(prisma, tripId);
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('receipt');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Receipt file is required.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const receipt = await storeReceipt(
      prisma,
      trip,
      file.name,
      file.type,
      buffer
    );

    return NextResponse.json({ ok: true, receiptId: receipt.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 });
  }
}
