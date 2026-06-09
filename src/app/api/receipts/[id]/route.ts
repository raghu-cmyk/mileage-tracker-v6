import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { getReceipt, readReceiptBytes } from '@/lib/receipts';
import { requireAuthenticatedUser } from '@/lib/session';

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAuthenticatedUser();
    const receiptId = parseInt(params.id, 10);
    if (Number.isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt id.' }, { status: 400 });
    }

    const receipt = await getReceipt(prisma, receiptId);
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
    }

    const bytes = await readReceiptBytes(receipt);
    if (!bytes) {
      return NextResponse.json({ error: 'Receipt file missing.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': receipt.contentType,
        'Content-Length': String(receipt.byteSize),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
