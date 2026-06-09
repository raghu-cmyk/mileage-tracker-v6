import { NextResponse } from 'next/server';
import { createUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AuthError } from '@/lib/errors';
import { establishSession } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? '');
    const password = String(body.password ?? '');

    const user = await createUser(prisma, username, password);
    await establishSession(user.id);

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }
}
