import 'server-only';

import { hash, verify } from '@node-rs/argon2';
import type { User } from '@prisma/client';
import type { DbClient } from './db';
import { AuthError } from './errors';

import { MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_SECONDS, SESSION_TTL_SECONDS } from './constants';

interface LoginAttemptTracker {
  attempts: number[];
}

const loginAttempts = new Map<string, LoginAttemptTracker>();

function getTracker(clientKey: string): LoginAttemptTracker {
  let tracker = loginAttempts.get(clientKey);
  if (!tracker) {
    tracker = { attempts: [] };
    loginAttempts.set(clientKey, tracker);
  }
  return tracker;
}

function pruneAttempts(tracker: LoginAttemptTracker, now: number): number[] {
  const cutoff = now - LOGIN_WINDOW_SECONDS;
  tracker.attempts = tracker.attempts.filter((t) => t >= cutoff);
  return tracker.attempts;
}

export function isRateLimited(clientKey: string, now: number = Date.now() / 1000): boolean {
  const tracker = getTracker(clientKey);
  const recent = pruneAttempts(tracker, now);
  return recent.length >= MAX_LOGIN_ATTEMPTS;
}

function recordFailure(clientKey: string, now: number): void {
  const tracker = getTracker(clientKey);
  tracker.attempts.push(now);
  pruneAttempts(tracker, now);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    outputLen: 32,
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function getUserCount(db: DbClient): Promise<number> {
  return db.user.count();
}

export async function createUser(
  db: DbClient,
  username: string,
  password: string
): Promise<User> {
  const count = await getUserCount(db);
  if (count >= 1) {
    throw new AuthError('Registration is closed. A user account already exists.', 403);
  }

  const trimmed = username.trim();
  const existing = await db.user.findUnique({ where: { username: trimmed } });
  if (existing) {
    throw new AuthError('Username already taken.', 409);
  }

  if (!password || password.length < 8) {
    throw new AuthError('Password must be at least 8 characters.', 400);
  }

  return db.user.create({
    data: {
      username: trimmed,
      passwordHash: await hashPassword(password),
    },
  });
}

export async function authenticateUser(
  db: DbClient,
  username: string,
  password: string,
  clientKey: string
): Promise<User> {
  const now = Date.now() / 1000;
  if (isRateLimited(clientKey, now)) {
    throw new AuthError('Too many failed login attempts. Try again in a few minutes.', 429);
  }

  const user = await db.user.findUnique({ where: { username: username.trim() } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    recordFailure(clientKey, now);
    throw new AuthError('Invalid username or password.', 401);
  }

  getTracker(clientKey).attempts = [];
  return user;
}

export async function getUserById(db: DbClient, userId: number): Promise<User | null> {
  return db.user.findUnique({ where: { id: userId } });
}

export function getClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
