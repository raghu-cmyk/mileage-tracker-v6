import type { Vehicle, VehicleOdometerReading } from '@prisma/client';
import { recordAuditEvent } from './audit';
import type { DbClient } from './db';
import { OdometerOrderingError, ValidationError, VehicleHasTripsError } from './errors';

function validateOdometerPair(start: number | null, end: number | null): void {
  if (start != null && start < 0) {
    throw new ValidationError('Start-of-year odometer cannot be negative.');
  }
  if (end != null && end < 0) {
    throw new ValidationError('End-of-year odometer cannot be negative.');
  }
  if (start != null && end != null && end < start) {
    throw new OdometerOrderingError(
      'End-of-year odometer must be greater than or equal to start-of-year odometer.'
    );
  }
}

export async function listVehicles(db: DbClient, includeArchived = false): Promise<Vehicle[]> {
  return db.vehicle.findMany({
    where: includeArchived ? {} : { isArchived: false },
    orderBy: { displayName: 'asc' },
  });
}

export async function getVehicle(db: DbClient, vehicleId: number): Promise<Vehicle | null> {
  return db.vehicle.findUnique({ where: { id: vehicleId } });
}

export async function vehicleHasTrips(db: DbClient, vehicleId: number): Promise<boolean> {
  const trip = await db.trip.findFirst({ where: { vehicleId }, select: { id: true } });
  return trip != null;
}

export async function createVehicle(
  db: DbClient,
  displayName: string,
  description = ''
): Promise<Vehicle> {
  const name = displayName.trim();
  if (!name) {
    throw new ValidationError('Display name is required.');
  }

  const vehicle = await db.vehicle.create({
    data: { displayName: name, description: description.trim() },
  });

  await recordAuditEvent(db, {
    entityType: 'vehicle',
    entityId: vehicle.id,
    action: 'create',
    fieldChanges: { display_name: name, description: description.trim() },
  });

  return vehicle;
}

export async function updateVehicle(
  db: DbClient,
  vehicle: Vehicle,
  displayName: string,
  description: string
): Promise<Vehicle> {
  const name = displayName.trim();
  if (!name) {
    throw new ValidationError('Display name is required.');
  }

  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const newDescription = description.trim();

  if (vehicle.displayName !== name) {
    changes.display_name = { old: vehicle.displayName, new: name };
  }
  if (vehicle.description !== newDescription) {
    changes.description = { old: vehicle.description, new: newDescription };
  }

  const updated = await db.vehicle.update({
    where: { id: vehicle.id },
    data: { displayName: name, description: newDescription },
  });

  if (Object.keys(changes).length > 0) {
    await recordAuditEvent(db, {
      entityType: 'vehicle',
      entityId: vehicle.id,
      action: 'update',
      fieldChanges: changes,
    });
  }

  return updated;
}

export async function archiveVehicle(db: DbClient, vehicle: Vehicle): Promise<Vehicle> {
  if (vehicle.isArchived) return vehicle;

  const updated = await db.vehicle.update({
    where: { id: vehicle.id },
    data: { isArchived: true },
  });

  await recordAuditEvent(db, {
    entityType: 'vehicle',
    entityId: vehicle.id,
    action: 'archive',
    fieldChanges: { is_archived: { old: false, new: true } },
  });

  return updated;
}

export async function deleteVehicle(db: DbClient, vehicle: Vehicle): Promise<void> {
  if (await vehicleHasTrips(db, vehicle.id)) {
    throw new VehicleHasTripsError(
      'This vehicle has associated trips and cannot be deleted. Archive it instead.'
    );
  }

  await db.vehicle.delete({ where: { id: vehicle.id } });

  await recordAuditEvent(db, {
    entityType: 'vehicle',
    entityId: vehicle.id,
    action: 'delete',
    fieldChanges: { display_name: vehicle.displayName },
  });
}

export async function getOdometerReading(
  db: DbClient,
  vehicleId: number,
  taxYear: number
): Promise<VehicleOdometerReading | null> {
  return db.vehicleOdometerReading.findUnique({
    where: { uq_vehicle_tax_year: { vehicleId, taxYear } },
  });
}

export async function listOdometerReadings(
  db: DbClient,
  vehicleId: number
): Promise<VehicleOdometerReading[]> {
  return db.vehicleOdometerReading.findMany({
    where: { vehicleId },
    orderBy: { taxYear: 'desc' },
  });
}

function parseOdometerValue(raw: string | null | undefined, label: string): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const parsed = parseInt(String(raw).trim(), 10);
  if (Number.isNaN(parsed)) {
    throw new ValidationError(`${label} must be a whole number.`);
  }
  return parsed;
}

export async function upsertOdometerReading(
  db: DbClient,
  vehicle: Vehicle,
  taxYear: number,
  odometerYearStartRaw: string | null | undefined,
  odometerYearEndRaw: string | null | undefined
): Promise<VehicleOdometerReading> {
  if (taxYear < 2000 || taxYear > 2100) {
    throw new ValidationError('Tax year must be between 2000 and 2100.');
  }

  const start = parseOdometerValue(odometerYearStartRaw, 'Start-of-year odometer');
  const end = parseOdometerValue(odometerYearEndRaw, 'End-of-year odometer');
  validateOdometerPair(start, end);

  const existing = await getOdometerReading(db, vehicle.id, taxYear);

  if (!existing) {
    const reading = await db.vehicleOdometerReading.create({
      data: {
        vehicleId: vehicle.id,
        taxYear,
        odometerYearStart: start,
        odometerYearEnd: end,
      },
    });

    await recordAuditEvent(db, {
      entityType: 'vehicle_odometer',
      entityId: reading.id,
      action: 'create',
      fieldChanges: {
        vehicle_id: vehicle.id,
        tax_year: taxYear,
        odometer_year_start: start,
        odometer_year_end: end,
      },
    });

    return reading;
  }

  const changes: Record<string, { old: unknown; new: unknown }> = {};
  if (existing.odometerYearStart !== start) {
    changes.odometer_year_start = { old: existing.odometerYearStart, new: start };
  }
  if (existing.odometerYearEnd !== end) {
    changes.odometer_year_end = { old: existing.odometerYearEnd, new: end };
  }

  const updated = await db.vehicleOdometerReading.update({
    where: { id: existing.id },
    data: { odometerYearStart: start, odometerYearEnd: end },
  });

  if (Object.keys(changes).length > 0) {
    await recordAuditEvent(db, {
      entityType: 'vehicle_odometer',
      entityId: existing.id,
      action: 'update',
      fieldChanges: { tax_year: taxYear, ...changes },
    });
  }

  return updated;
}
