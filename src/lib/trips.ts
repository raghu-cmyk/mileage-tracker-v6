import { Decimal } from '@prisma/client/runtime/library';
import type { Trip, TripCategory, Vehicle } from '@prisma/client';
import { recordAuditEvent } from './audit';
import type { DbClient } from './db';
import { ValidationError } from './errors';

export interface TripFilters {
  vehicleId?: number;
  categoryId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

function parseTripDate(raw: string | null | undefined): Date {
  if (raw == null || String(raw).trim() === '') {
    throw new ValidationError('Trip date is required.');
  }
  const trimmed = String(raw).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new ValidationError('Trip date must be a valid date (YYYY-MM-DD).');
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError('Trip date must be a valid date (YYYY-MM-DD).');
  }
  return date;
}

function parseMiles(raw: string | null | undefined): Decimal {
  if (raw == null || String(raw).trim() === '') {
    throw new ValidationError('Miles is required.');
  }
  try {
    const value = new Decimal(String(raw).trim());
    if (value.lte(0)) {
      throw new ValidationError('Miles must be a positive number.');
    }
    return value;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Miles must be a positive number.');
  }
}

function parseOptionalOdometer(raw: string | null | undefined, label: string): number | null {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  const parsed = parseInt(String(raw).trim(), 10);
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`${label} must be a whole number.`);
  }
  if (parsed < 0) {
    throw new ValidationError(`${label} cannot be negative.`);
  }
  return parsed;
}

async function validateTripFields(
  db: DbClient,
  fields: {
    tripDateRaw?: string | null;
    origin?: string | null;
    destination?: string | null;
    businessPurpose?: string | null;
    milesRaw?: string | null;
    categoryIdRaw?: string | null;
    vehicleIdRaw?: string | null;
  }
): Promise<{
  tripDate: Date;
  origin: string;
  destination: string;
  businessPurpose: string;
  miles: Decimal;
  categoryId: number;
  vehicleId: number;
}> {
  const tripDate = parseTripDate(fields.tripDateRaw);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (tripDate > todayUtc) {
    throw new ValidationError('Trip date cannot be in the future.');
  }

  const origin = (fields.origin ?? '').trim();
  if (!origin) throw new ValidationError('Origin is required.');

  const destination = (fields.destination ?? '').trim();
  if (!destination) throw new ValidationError('Destination is required.');

  const businessPurpose = (fields.businessPurpose ?? '').trim();
  if (!businessPurpose) throw new ValidationError('Business purpose is required.');

  const miles = parseMiles(fields.milesRaw);

  if (fields.categoryIdRaw == null || String(fields.categoryIdRaw).trim() === '') {
    throw new ValidationError('Category is required.');
  }
  const categoryId = parseInt(String(fields.categoryIdRaw).trim(), 10);
  if (Number.isNaN(categoryId)) {
    throw new ValidationError('Category is required.');
  }
  const category = await db.tripCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new ValidationError('Category is required.');

  if (fields.vehicleIdRaw == null || String(fields.vehicleIdRaw).trim() === '') {
    throw new ValidationError('Vehicle is required.');
  }
  const vehicleId = parseInt(String(fields.vehicleIdRaw).trim(), 10);
  if (Number.isNaN(vehicleId)) {
    throw new ValidationError('Vehicle is required.');
  }
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.isArchived) {
    throw new ValidationError('Vehicle is required.');
  }

  return { tripDate, origin, destination, businessPurpose, miles, categoryId, vehicleId };
}

export async function listTrips(db: DbClient, filters: TripFilters = {}) {
  const tripDateFilter =
    filters.dateFrom != null || filters.dateTo != null
      ? {
          ...(filters.dateFrom != null ? { gte: filters.dateFrom } : {}),
          ...(filters.dateTo != null ? { lte: filters.dateTo } : {}),
        }
      : undefined;

  return db.trip.findMany({
    where: {
      ...(filters.vehicleId != null ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.categoryId != null ? { categoryId: filters.categoryId } : {}),
      ...(tripDateFilter ? { tripDate: tripDateFilter } : {}),
    },
    include: { vehicle: true, category: true, receipts: true },
    orderBy: [{ tripDate: 'desc' }, { id: 'desc' }],
  });
}

export async function getTrip(db: DbClient, tripId: number) {
  return db.trip.findUnique({
    where: { id: tripId },
    include: { vehicle: true, category: true, receipts: true },
  });
}

export async function createTrip(
  db: DbClient,
  fields: {
    tripDateRaw?: string | null;
    origin?: string | null;
    destination?: string | null;
    businessPurpose?: string | null;
    milesRaw?: string | null;
    categoryIdRaw?: string | null;
    vehicleIdRaw?: string | null;
    odometerStartRaw?: string | null;
    odometerEndRaw?: string | null;
  }
) {
  const validated = await validateTripFields(db, fields);
  const odometerStart = parseOptionalOdometer(fields.odometerStartRaw, 'Odometer start');
  const odometerEnd = parseOptionalOdometer(fields.odometerEndRaw, 'Odometer end');

  const trip = await db.trip.create({
    data: {
      tripDate: validated.tripDate,
      origin: validated.origin,
      destination: validated.destination,
      businessPurpose: validated.businessPurpose,
      miles: validated.miles,
      categoryId: validated.categoryId,
      vehicleId: validated.vehicleId,
      odometerStart,
      odometerEnd,
    },
    include: { vehicle: true, category: true },
  });

  await recordAuditEvent(db, {
    entityType: 'trip',
    entityId: trip.id,
    action: 'create',
    fieldChanges: {
      trip_date: validated.tripDate.toISOString().slice(0, 10),
      origin: validated.origin,
      destination: validated.destination,
      business_purpose: validated.businessPurpose,
      miles: validated.miles.toString(),
      category_id: validated.categoryId,
      vehicle_id: validated.vehicleId,
      odometer_start: odometerStart,
      odometer_end: odometerEnd,
    },
  });

  return trip;
}

export async function updateTrip(
  db: DbClient,
  trip: Trip,
  fields: {
    tripDateRaw?: string | null;
    origin?: string | null;
    destination?: string | null;
    businessPurpose?: string | null;
    milesRaw?: string | null;
    categoryIdRaw?: string | null;
    vehicleIdRaw?: string | null;
    odometerStartRaw?: string | null;
    odometerEndRaw?: string | null;
  }
) {
  const validated = await validateTripFields(db, fields);
  const odometerStart = parseOptionalOdometer(fields.odometerStartRaw, 'Odometer start');
  const odometerEnd = parseOptionalOdometer(fields.odometerEndRaw, 'Odometer end');

  const changes: Record<string, unknown> = {};

  const tripDateStr = validated.tripDate.toISOString().slice(0, 10);
  const existingDateStr = trip.tripDate.toISOString().slice(0, 10);
  if (existingDateStr !== tripDateStr) {
    changes.trip_date = { old: existingDateStr, new: tripDateStr };
  }
  if (trip.origin !== validated.origin) {
    changes.origin = { old: trip.origin, new: validated.origin };
  }
  if (trip.destination !== validated.destination) {
    changes.destination = { old: trip.destination, new: validated.destination };
  }
  if (trip.businessPurpose !== validated.businessPurpose) {
    changes.business_purpose = { old: trip.businessPurpose, new: validated.businessPurpose };
  }
  if (!trip.miles.equals(validated.miles)) {
    changes.miles = { old: trip.miles.toString(), new: validated.miles.toString() };
  }
  if (trip.categoryId !== validated.categoryId) {
    changes.category_id = { old: trip.categoryId, new: validated.categoryId };
  }
  if (trip.vehicleId !== validated.vehicleId) {
    changes.vehicle_id = { old: trip.vehicleId, new: validated.vehicleId };
  }
  if (trip.odometerStart !== odometerStart) {
    changes.odometer_start = { old: trip.odometerStart, new: odometerStart };
  }
  if (trip.odometerEnd !== odometerEnd) {
    changes.odometer_end = { old: trip.odometerEnd, new: odometerEnd };
  }

  const updated = await db.trip.update({
    where: { id: trip.id },
    data: {
      tripDate: validated.tripDate,
      origin: validated.origin,
      destination: validated.destination,
      businessPurpose: validated.businessPurpose,
      miles: validated.miles,
      categoryId: validated.categoryId,
      vehicleId: validated.vehicleId,
      odometerStart,
      odometerEnd,
    },
    include: { vehicle: true, category: true, receipts: true },
  });

  if (Object.keys(changes).length > 0) {
    await recordAuditEvent(db, {
      entityType: 'trip',
      entityId: trip.id,
      action: 'update',
      fieldChanges: changes,
    });
  }

  return updated;
}

export async function deleteTrip(db: DbClient, trip: Trip & { receipts?: { id: number }[] }) {
  const { deleteReceiptsForTrip } = await import('./receipts');
  await deleteReceiptsForTrip(db, trip.id);

  const snapshot = {
    trip_date: trip.tripDate.toISOString().slice(0, 10),
    origin: trip.origin,
    destination: trip.destination,
    business_purpose: trip.businessPurpose,
    miles: trip.miles.toString(),
    category_id: trip.categoryId,
    vehicle_id: trip.vehicleId,
  };

  await db.trip.delete({ where: { id: trip.id } });

  await recordAuditEvent(db, {
    entityType: 'trip',
    entityId: trip.id,
    action: 'delete',
    fieldChanges: snapshot,
  });
}

export async function listCategories(db: DbClient): Promise<TripCategory[]> {
  return db.tripCategory.findMany({ orderBy: { displayName: 'asc' } });
}

export type TripWithRelations = Trip & {
  vehicle: Vehicle;
  category: TripCategory;
};
