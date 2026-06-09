import { NextResponse } from 'next/server';
import { renderYearSummaryPdf } from '@/lib/exports';
import { prisma } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { requireAuthenticatedUser } from '@/lib/session';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? '', 10);
    if (Number.isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
    }

    const pdf = await renderYearSummaryPdf(prisma, year);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mileage-summary-${year}.pdf"`,
      },
    });
  } catch (err) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
