import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { computeYearSummary, formatCents, isLateEntered } from '@/lib/deductions';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import { listTrips } from '@/lib/trips';
import { listVehicles } from '@/lib/vehicles';

export default async function DashboardPage() {
  await requireAuthenticatedUser();
  const vehicles = await listVehicles(prisma);
  const recentTrips = (await listTrips(prisma)).slice(0, 5);
  const currentYear = new Date().getFullYear();
  let summary = null;
  try {
    summary = await computeYearSummary(prisma, currentYear);
  } catch {
    summary = null;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your mileage log and deductions."
        actions={
          <Link href="/trips/new" className="btn btn-primary">
            Log a trip
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary">
            {currentYear} year-to-date
          </h2>
          {summary ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Total miles</dt>
                <dd className="font-mono">{summary.totalMiles.toString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Deductible amount</dt>
                <dd className="font-mono text-success">{formatCents(summary.totalDeductionCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Business-use %</dt>
                <dd className="font-mono">
                  {summary.businessUsePercentage != null
                    ? `${summary.businessUsePercentage}%`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Late-entered trips</dt>
                <dd className="font-mono">{summary.lateEnteredCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-text-secondary">Unable to compute summary.</p>
          )}
          <Link href="/reports" className="btn btn-secondary mt-4 inline-flex">
            View reports
          </Link>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary">Vehicles</h2>
          <p className="mt-1 text-sm text-text-secondary">{vehicles.length} active</p>
          {vehicles.length === 0 ? (
            <EmptyState
              message="No vehicles yet."
              actionLabel="Add a vehicle"
              actionHref="/vehicles/new"
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {vehicles.slice(0, 3).map((v) => (
                <li key={v.id}>
                  <Link href={`/vehicles/${v.id}`} className="text-primary hover:underline">
                    {v.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="text-xl font-semibold text-text-primary">Recent trips</h2>
        {recentTrips.length === 0 ? (
          <EmptyState
            message="No trips logged yet."
            actionLabel="Log your first trip"
            actionHref="/trips/new"
          />
        ) : (
          <div className="table-scroll mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Route</th>
                  <th scope="col">Miles</th>
                  <th scope="col">Category</th>
                </tr>
              </thead>
              <tbody>
                {recentTrips.map((trip) => (
                  <tr key={trip.id} className={isLateEntered(trip) ? 'row-late' : ''}>
                    <td>
                      <Link href={`/trips/${trip.id}`} className="text-primary hover:underline">
                        {trip.tripDate.toISOString().slice(0, 10)}
                      </Link>
                      {isLateEntered(trip) && (
                        <span className="badge-late ml-2">Late</span>
                      )}
                    </td>
                    <td>
                      {trip.origin} → {trip.destination}
                    </td>
                    <td className="font-mono">{trip.miles.toString()}</td>
                    <td>{trip.category.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
