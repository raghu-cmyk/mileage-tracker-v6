import type { SessionOptions } from 'iron-session';
import { SESSION_TTL_SECONDS } from './constants';

export interface SessionData {
  userId?: number;
  expiresAt?: number;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? 'dev-only-change-in-production-min-32-chars!!',
  cookieName: 'mileage_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
  },
};
