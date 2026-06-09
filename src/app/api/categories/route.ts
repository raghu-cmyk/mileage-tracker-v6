import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import { listCategories } from '@/lib/trips';

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const categories = await listCategories(prisma);
    return NextResponse.json(
      categories.map((c) => ({ id: c.id, code: c.code, displayName: c.displayName }))
    );
  } catch {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
}
