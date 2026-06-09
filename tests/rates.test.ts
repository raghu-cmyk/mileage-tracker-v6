import { describe, expect, it, beforeEach, afterEach, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { RateResolutionError, RateTableValidationError } from '@/lib/errors';
import {
  RATE_SCALE,
  rateCentsPerMileDecimal,
  resolveRate,
  validateRateTable,
} from '@/lib/rates';

const TEST_DB = path.join(process.cwd(), 'prisma', 'test-rates.db');

describe('Rate resolution', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
      stdio: 'pipe',
    });
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = `file:${TEST_DB}`;
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${TEST_DB}` } },
    });

    await prisma.mileageRate.deleteMany();
    await prisma.mileageRate.createMany({
      data: [
        {
          categoryCode: 'business',
          rateCentsPerMile: 725,
          effectiveStartDate: new Date('2026-01-01'),
          effectiveEndDate: new Date('2026-12-31'),
        },
        {
          categoryCode: 'medical',
          rateCentsPerMile: 205,
          effectiveStartDate: new Date('2026-01-01'),
          effectiveEndDate: new Date('2026-12-31'),
        },
        {
          categoryCode: 'moving',
          rateCentsPerMile: 205,
          effectiveStartDate: new Date('2026-01-01'),
          effectiveEndDate: new Date('2026-12-31'),
        },
        {
          categoryCode: 'charitable',
          rateCentsPerMile: 140,
          effectiveStartDate: new Date('2026-01-01'),
          effectiveEndDate: new Date('2026-12-31'),
        },
        {
          categoryCode: 'business',
          rateCentsPerMile: 700,
          effectiveStartDate: new Date('2025-01-01'),
          effectiveEndDate: new Date('2025-12-31'),
        },
      ],
    });
    await validateRateTable(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  it('resolves 2026 business rate', async () => {
    const rate = await resolveRate(prisma, 'business', new Date('2026-06-15'));
    expect(rate.rateCentsPerMile).toBe(725);
    expect(rateCentsPerMileDecimal(rate.rateCentsPerMile)).toBe(72.5);
  });

  it('resolves 2025 business rate', async () => {
    const rate = await resolveRate(prisma, 'business', new Date('2025-03-01'));
    expect(rate.rateCentsPerMile).toBe(700);
    expect(rateCentsPerMileDecimal(rate.rateCentsPerMile)).toBe(70);
  });

  it('resolves 2026 medical rate', async () => {
    const rate = await resolveRate(prisma, 'medical', new Date('2026-01-01'));
    expect(rate.rateCentsPerMile).toBe(205);
    expect(rateCentsPerMileDecimal(rate.rateCentsPerMile)).toBe(20.5);
  });

  it('resolves 2026 charitable rate', async () => {
    const rate = await resolveRate(prisma, 'charitable', new Date('2026-12-31'));
    expect(rate.rateCentsPerMile).toBe(140);
    expect(rateCentsPerMileDecimal(rate.rateCentsPerMile)).toBe(14);
  });

  it('raises on zero matches', async () => {
    await expect(resolveRate(prisma, 'business', new Date('2024-01-01'))).rejects.toThrow(
      RateResolutionError
    );
    await expect(resolveRate(prisma, 'business', new Date('2024-01-01'))).rejects.toMatchObject({
      message: expect.stringContaining('No mileage rate found'),
    });
  });

  it('raises on multiple matches', async () => {
    await prisma.mileageRate.create({
      data: {
        categoryCode: 'business',
        rateCentsPerMile: 800,
        effectiveStartDate: new Date('2026-01-01'),
        effectiveEndDate: new Date('2026-12-31'),
      },
    });
    await expect(resolveRate(prisma, 'business', new Date('2026-06-01'))).rejects.toThrow(
      RateResolutionError
    );
  });

  it('rejects overlapping windows', async () => {
    await prisma.mileageRate.create({
      data: {
        categoryCode: 'moving',
        rateCentsPerMile: 300,
        effectiveStartDate: new Date('2026-06-01'),
        effectiveEndDate: new Date('2026-12-31'),
      },
    });
    await expect(validateRateTable(prisma)).rejects.toThrow(RateTableValidationError);
  });

  it('uses RATE_SCALE of 10', () => {
    expect(RATE_SCALE).toBe(10);
  });
});
