import type { MileageRate } from '@prisma/client';
import type { DbClient } from './db';
import { RateResolutionError, RateTableValidationError } from './errors';
import { RATE_SCALE } from './constants';

export { RATE_SCALE };

export function rateCentsPerMileDecimal(storedValue: number): number {
  return storedValue / RATE_SCALE;
}

interface RateWindow {
  categoryCode: string;
  effectiveStartDate: Date;
  effectiveEndDate: Date;
  rateId: number;
}

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function validateRateTable(db: DbClient): Promise<void> {
  const rates = await db.mileageRate.findMany({
    orderBy: [{ categoryCode: 'asc' }, { effectiveStartDate: 'asc' }],
  });

  const windows: RateWindow[] = [];
  for (const rate of rates) {
    if (rate.effectiveStartDate > rate.effectiveEndDate) {
      throw new RateTableValidationError(
        `Rate id=${rate.id} for category '${rate.categoryCode}' has effective_start_date after effective_end_date.`
      );
    }
    windows.push({
      categoryCode: rate.categoryCode,
      effectiveStartDate: rate.effectiveStartDate,
      effectiveEndDate: rate.effectiveEndDate,
      rateId: rate.id,
    });
  }

  const byCategory = new Map<string, RateWindow[]>();
  for (const window of windows) {
    const list = byCategory.get(window.categoryCode) ?? [];
    list.push(window);
    byCategory.set(window.categoryCode, list);
  }

  for (const [categoryCode, categoryWindows] of Array.from(byCategory.entries())) {
    const sorted = [...categoryWindows].sort(
      (a, b) => a.effectiveStartDate.getTime() - b.effectiveStartDate.getTime()
    );
    for (let idx = 1; idx < sorted.length; idx++) {
      const prev = sorted[idx - 1];
      const curr = sorted[idx];
      if (curr.effectiveStartDate <= prev.effectiveEndDate) {
        throw new RateTableValidationError(
          `Overlapping mileage rates for category '${categoryCode}': rate id=${prev.rateId} ` +
            `[${prev.effectiveStartDate.toISOString().slice(0, 10)}..${prev.effectiveEndDate.toISOString().slice(0, 10)}] ` +
            `overlaps rate id=${curr.rateId} [${curr.effectiveStartDate.toISOString().slice(0, 10)}..${curr.effectiveEndDate.toISOString().slice(0, 10)}].`
        );
      }
    }
  }
}

export async function resolveRate(
  db: DbClient,
  categoryCode: string,
  tripDate: Date
): Promise<MileageRate> {
  const dateOnly = toDateOnly(tripDate);
  const matches = await db.mileageRate.findMany({
    where: {
      categoryCode,
      effectiveStartDate: { lte: dateOnly },
      effectiveEndDate: { gte: dateOnly },
    },
  });

  if (matches.length === 0) {
    throw new RateResolutionError(
      `No mileage rate found for category '${categoryCode}' on ${dateOnly.toISOString().slice(0, 10)}.`
    );
  }
  if (matches.length > 1) {
    const ids = matches.map((r) => r.id).join(', ');
    throw new RateResolutionError(
      `Ambiguous mileage rate for category '${categoryCode}' on ${dateOnly.toISOString().slice(0, 10)}: matched rate ids [${ids}].`
    );
  }
  return matches[0];
}

export function formatRateDisplay(storedRate: number): string {
  const cents = rateCentsPerMileDecimal(storedRate);
  const formatted = Number.isInteger(cents) ? cents.toString() : cents.toFixed(1);
  return `${formatted}¢/mi`;
}
