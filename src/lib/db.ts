import path from 'path';
import { PrismaClient } from '@prisma/client';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type DbClient = PrismaClient;
