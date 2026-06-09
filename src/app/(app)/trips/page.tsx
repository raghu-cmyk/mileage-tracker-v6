import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { computeTripDeduction, formatCents, isLateEntered } from '@/lib/deductions';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import { listCategories, listTrips } from '@/lib/trips';
import { listVehicles } from '@/lib/vehicles';

interface TripsPageProps {
  searchParams: {
    vehicle_id?: string;
    category_id?: string;
    date_from?: string;
    date_to?: string;
  };
}

function parseOptionalInt(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)));
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  await requireAuthenticatedUser();

  const trips = await listTrips(prisma, {
    vehicleId: parseOptionalInt(searchParams.vehicle_id),
    categoryId: parseOptionalInt(searchParams.category_id),
    dateFrom: parseOptionalDate(searchParams.date_from),
    dateTo: parseOptionalDate(searchParams.date_to),
  });

  const [categories, vehicles] = await Promise.all([
    listCategories(prisma),
    listVehicles(prisma),
  ]);

  const deductions = await Promise.all(trips.map((t) => computeTripDeduction(prisma, t)));

  return (
    <>
      <PageHeader
        title="Trips"
        description="Full §274(d) substantiation log with contemporaneousness flags."
        actions={
          <Link href="/trips/new" className="btn btn-primary">
            Log trip
          </Link>
        }
      />

      <form method="GET" className="card mb-6 grid gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="vehicle_id" className="form-label">
            Vehicle
          </label>
          <select
            id="vehicle_id"
            name="vehicle_id"
            defaultValue={searchParams.vehicle_id ?? ''}
            className="form-input"
          >
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category_id" className="form-label">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={searchParams.category_id ?? ''}
            className="form-input"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date_from" className="form-label">
            From
          </label>
          <input
            id="date_from"
            name="date_from"
            type="date"
            defaultValue={searchParams.date_from ?? ''}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="date_to" className="form-label">
            To
          </label>
          <input
            id="date_to"
            name="date_to"
            type="date"
            defaultValue={searchParams.date_to ?? ''}
            className="form-input"
          />
        </div>
        <div className="md:col-span-4">
          <button type="submit" className="btn btn-secondary">
            Apply filters
          </button>
        </div>
      </form>

      {trips.length === 0 ? (
        <div className="card">
          <EmptyState
            message="No trips match your filters."
            actionLabel="Log your first trip"
            actionHref="/trips/new"
          />
        </div>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Route</th>
                <th scope="col">Miles</th>
                <th scope="col">Category</th>
                <th scope="col">Deduction</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip, idx) => {
                const deduction = deductions[idx];
                return (
                  <tr key={trip.id} className={isLateEntered(trip) ? 'row-late' : ''}>
                    <td>
                      <Link href={`/trips/${trip.id}`} className="text-primary hover:underline">
                        {trip.tripDate.toISOString().slice(0, 10)}
                      </Link>
                      {isLateEntered(trip) && <span className="badge-late ml-2">Late</span>}
                    </td>
                    <td>
                      {trip.origin} → {trip.destination}
                    </td>
                    <td className="font-mono">{trip.miles.toString()}</td>
                    <td>{trip.category.displayName}</td>
                    <td className="font-mono">
                      {deduction.isDeductible ? formatCents(deduction.deductionCents) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
