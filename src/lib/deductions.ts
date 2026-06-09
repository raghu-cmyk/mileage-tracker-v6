import type { Trip, TripCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { DbClient } from './db';
import { LATE_ENTRY_THRESHOLD_DAYS, MILES_SCALE } from './constants';
import { RATE_SCALE, resolveRate } from './rates';
import { listTrips } from './trips';

export { MILES_SCALE, LATE_ENTRY_THRESHOLD_DAYS };

export interface TripDeduction {
  tripId: number;
  tripDate: Date;
  categoryCode: string;
  categoryDisplayName: string;
  miles: Decimal;
  rateCentsPerMile: number | null;
  deductionCents: number;
  isDeductible: boolean;
  isLateEntered: boolean;
}

export interface CategorySummary {
  categoryCode: string;
  displayName: string;
  isDeductible: boolean;
  totalMiles: Decimal;
  totalDeductionCents: number;
}

export interface YearSummary {
  taxYear: number;
  totalMiles: Decimal;
  deductibleMiles: Decimal;
  personalMiles: Decimal;
  totalDeductionCents: number;
  businessUsePercentage: Decimal | null;
  lateEnteredCount: number;
  byCategory: CategorySummary[];
  tripDeductions: TripDeduction[];
}

export function isLateEntered(trip: Trip): boolean {
  const created = new Date(trip.createdAt);
  const createdDate = new Date(
    Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())
  );
  const tripDate = new Date(trip.tripDate);
  const tripDateOnly = new Date(
    Date.UTC(tripDate.getUTCFullYear(), tripDate.getUTCMonth(), tripDate.getUTCDate())
  );
  const diffMs = createdDate.getTime() - tripDateOnly.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > LATE_ENTRY_THRESHOLD_DAYS;
}

export function milesToHundredths(miles: Decimal): number {
  const normalized = miles.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return Math.round(Number(normalized) * MILES_SCALE);
}

export function computeTripDeductionCents(miles: Decimal, rateCentsPerMile: number): number {
  const milesHundredths = milesToHundredths(miles);
  const product = milesHundredths * rateCentsPerMile;
  const denominator = MILES_SCALE * RATE_SCALE;
  return Math.floor((product + Math.floor(denominator / 2)) / denominator);
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, '0')}`;
}

export async function computeTripDeduction(
  db: DbClient,
  trip: Trip & { category: TripCategory }
): Promise<TripDeduction> {
  const category = trip.category;
  if (!category.isDeductible) {
    return {
      tripId: trip.id,
      tripDate: trip.tripDate,
      categoryCode: category.code,
      categoryDisplayName: category.displayName,
      miles: trip.miles,
      rateCentsPerMile: null,
      deductionCents: 0,
      isDeductible: false,
      isLateEntered: isLateEntered(trip),
    };
  }

  const rate = await resolveRate(db, category.code, trip.tripDate);
  const deductionCents = computeTripDeductionCents(trip.miles, rate.rateCentsPerMile);

  return {
    tripId: trip.id,
    tripDate: trip.tripDate,
    categoryCode: category.code,
    categoryDisplayName: category.displayName,
    miles: trip.miles,
    rateCentsPerMile: rate.rateCentsPerMile,
    deductionCents,
    isDeductible: true,
    isLateEntered: isLateEntered(trip),
  };
}

export async function computeYearSummary(db: DbClient, taxYear: number): Promise<YearSummary> {
  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear, 11, 31));

  const trips = await listTrips(db, { dateFrom: yearStart, dateTo: yearEnd });

  const tripDeductions: TripDeduction[] = [];
  const categoryTotals = new Map<string, CategorySummary>();
  let totalMiles = new Decimal(0);
  let deductibleMiles = new Decimal(0);
  let personalMiles = new Decimal(0);
  let totalDeductionCents = 0;
  let lateEnteredCount = 0;

  for (const trip of trips) {
    const deduction = await computeTripDeduction(db, trip);
    tripDeductions.push(deduction);
    totalMiles = totalMiles.add(trip.miles);

    if (deduction.isLateEntered) {
      lateEnteredCount += 1;
    }

    if (deduction.isDeductible) {
      deductibleMiles = deductibleMiles.add(trip.miles);
      totalDeductionCents += deduction.deductionCents;
    } else {
      personalMiles = personalMiles.add(trip.miles);
    }

    const existing = categoryTotals.get(deduction.categoryCode);
    if (!existing) {
      categoryTotals.set(deduction.categoryCode, {
        categoryCode: deduction.categoryCode,
        displayName: deduction.categoryDisplayName,
        isDeductible: deduction.isDeductible,
        totalMiles: trip.miles,
        totalDeductionCents: deduction.deductionCents,
      });
    } else {
      categoryTotals.set(deduction.categoryCode, {
        ...existing,
        totalMiles: existing.totalMiles.add(trip.miles),
        totalDeductionCents: existing.totalDeductionCents + deduction.deductionCents,
      });
    }
  }

  let businessUsePercentage: Decimal | null = null;
  if (totalMiles.greaterThan(0)) {
    businessUsePercentage = deductibleMiles
      .div(totalMiles)
      .mul(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const byCategory = Array.from(categoryTotals.values()).sort((a, b) => {
    if (a.isDeductible !== b.isDeductible) {
      return a.isDeductible ? -1 : 1;
    }
    return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
  });

  return {
    taxYear,
    totalMiles,
    deductibleMiles,
    personalMiles,
    totalDeductionCents,
    businessUsePercentage,
    lateEnteredCount,
    byCategory,
    tripDeductions,
  };
}

export function availableTaxYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => current - i);
}
