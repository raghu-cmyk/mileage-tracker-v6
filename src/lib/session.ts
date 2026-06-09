import 'server-only';

import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { SESSION_TTL_SECONDS } from './constants';
import { prisma } from './db';
import { AuthError } from './errors';
import { sessionOptions, type SessionData } from './session-config';

export { sessionOptions, type SessionData } from './session-config';

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function establishSession(userId: number): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.expiresAt = Date.now() / 1000 + SESSION_TTL_SECONDS;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function getCurrentUserId(): Promise<number | null> {
  const session = await getSession();
  if (session.userId == null || session.expiresAt == null) {
    return null;
  }
  if (Date.now() / 1000 > session.expiresAt) {
    await session.destroy();
    return null;
  }
  return session.userId;
}

export async function requireAuthenticatedUser(): Promise<User> {
  const userId = await getCurrentUserId();
  if (userId == null) {
    throw new AuthError('Authentication required.', 401);
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    await clearSession();
    throw new AuthError('Authentication required.', 401);
  }
  return user;
}
