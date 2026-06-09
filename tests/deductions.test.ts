import { describe, expect, it, beforeEach, afterEach, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { execSync } from 'child_process';
import path from 'path';
import {
  computeTripDeduction,
  computeTripDeductionCents,
  computeYearSummary,
  formatCents,
} from '@/lib/deductions';
import { RateResolutionError } from '@/lib/errors';

const TEST_DB = path.join(process.cwd(), 'prisma', 'test-deductions.db');

describe('Deduction calculation', () => {
  let prisma: PrismaClient;
  let businessId: number;
  let personalId: number;
  let vehicleId: number;

  beforeAll(() => {
    execSync('npx prisma db push --skip-generate', {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
      stdio: 'pipe',
    });
  });

  beforeEach(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${TEST_DB}` } },
    });

    await prisma.auditEvent.deleteMany();
    await prisma.receipt.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.vehicleOdometerReading.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.mileageRate.deleteMany();
    await prisma.tripCategory.deleteMany();

    const business = await prisma.tripCategory.create({
      data: { code: 'business', displayName: 'Business', isDeductible: true },
    });
    const personal = await prisma.tripCategory.create({
      data: { code: 'personal', displayName: 'Personal', isDeductible: false },
    });
    businessId = business.id;
    personalId = personal.id;

    await prisma.mileageRate.createMany({
      data: [
        {
          categoryCode: 'business',
          rateCentsPerMile: 725,
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

    const vehicle = await prisma.vehicle.create({
      data: { displayName: 'Test Car', description: '' },
    });
    vehicleId = vehicle.id;
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  async function addTrip(options: {
    tripDate: Date;
    miles: string;
    categoryId: number;
    createdAt?: Date;
  }) {
    return prisma.trip.create({
      data: {
        vehicleId,
        categoryId: options.categoryId,
        tripDate: options.tripDate,
        origin: 'A',
        destination: 'B',
        businessPurpose: 'Client visit',
        miles: new Decimal(options.miles),
        createdAt: options.createdAt ?? options.tripDate,
      },
      include: { category: true },
    });
  }

  it('computes exact deduction for whole miles', () => {
    expect(computeTripDeductionCents(new Decimal('10'), 725)).toBe(725);
    expect(formatCents(725)).toBe('$7.25');
  });

  it('computes exact deduction for fractional miles', () => {
    expect(computeTripDeductionCents(new Decimal('10.55'), 725)).toBe(765);
  });

  it('returns zero deduction for personal trips', async () => {
    const trip = await addTrip({
      tripDate: new Date('2026-03-01'),
      miles: '25.00',
      categoryId: personalId,
    });
    const deduction = await computeTripDeduction(prisma, trip);
    expect(deduction.isDeductible).toBe(false);
    expect(deduction.deductionCents).toBe(0);
    expect(deduction.rateCentsPerMile).toBeNull();
  });

  it('uses resolved rate for business trips', async () => {
    const trip = await addTrip({
      tripDate: new Date('2026-03-01'),
      miles: '100.00',
      categoryId: businessId,
    });
    const deduction = await computeTripDeduction(prisma, trip);
    expect(deduction.isDeductible).toBe(true);
    expect(deduction.rateCentsPerMile).toBe(725);
    expect(deduction.deductionCents).toBe(7250);
  });

  it('aggregates year summary by category', async () => {
    await addTrip({
      tripDate: new Date('2026-01-10'),
      miles: '10.00',
      categoryId: businessId,
    });
    await addTrip({
      tripDate: new Date('2026-02-10'),
      miles: '5.50',
      categoryId: businessId,
    });
    await addTrip({
      tripDate: new Date('2026-03-10'),
      miles: '20.00',
      categoryId: personalId,
    });
    await addTrip({
      tripDate: new Date('2026-03-01'),
      miles: '2.00',
      categoryId: businessId,
      createdAt: new Date('2026-03-20'),
    });

    const summary = await computeYearSummary(prisma, 2026);
    expect(summary.totalMiles.toString()).toBe('37.5');
    expect(summary.deductibleMiles.toString()).toBe('17.5');
    expect(summary.personalMiles.toString()).toBe('20');
    expect(summary.lateEnteredCount).toBe(1);
    expect(summary.businessUsePercentage?.toString()).toBe('46.67');

    const businessRow = summary.byCategory.find((r) => r.categoryCode === 'business');
    const personalRow = summary.byCategory.find((r) => r.categoryCode === 'personal');
    expect(businessRow?.totalMiles.toString()).toBe('17.5');
    expect(businessRow?.totalDeductionCents).toBeGreaterThan(0);
    expect(personalRow?.totalDeductionCents).toBe(0);
  });

  it('blocks calculation when rate is missing', async () => {
    const trip = await addTrip({
      tripDate: new Date('2024-01-01'),
      miles: '10.00',
      categoryId: businessId,
    });
    await expect(computeTripDeduction(prisma, trip)).rejects.toThrow(RateResolutionError);
  });

  it('handles empty year summary', async () => {
    const summary = await computeYearSummary(prisma, 2026);
    expect(summary.totalMiles.toString()).toBe('0');
    expect(summary.businessUsePercentage).toBeNull();
    expect(summary.lateEnteredCount).toBe(0);
  });
});
