import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import { listVehicles } from '@/lib/vehicles';

export default async function VehiclesPage() {
  await requireAuthenticatedUser();
  const vehicles = await listVehicles(prisma, true);

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Manage vehicles and annual odometer readings."
        actions={
          <Link href="/vehicles/new" className="btn btn-primary">
            Add vehicle
          </Link>
        }
      />

      {vehicles.length === 0 ? (
        <div className="card">
          <EmptyState
            message="No vehicles registered."
            actionLabel="Add a vehicle"
            actionHref="/vehicles/new"
          />
        </div>
      ) : (
        <div className="card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="text-primary hover:underline"
                    >
                      {vehicle.displayName}
                    </Link>
                  </td>
                  <td>{vehicle.description || '—'}</td>
                  <td>{vehicle.isArchived ? 'Archived' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
