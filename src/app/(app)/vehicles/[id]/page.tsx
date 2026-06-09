import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  archiveVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
  upsertOdometerAction,
  type ActionResult,
} from '@/app/actions/data';
import { PageHeader } from '@/components/PageHeader';
import { VehicleForm } from '@/components/VehicleForm';
import { availableTaxYears } from '@/lib/deductions';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import {
  getVehicle,
  listOdometerReadings,
  vehicleHasTrips,
} from '@/lib/vehicles';

interface VehicleDetailPageProps {
  params: { id: string };
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  await requireAuthenticatedUser();
  const vehicleId = parseInt(params.id, 10);
  if (Number.isNaN(vehicleId)) notFound();

  const vehicle = await getVehicle(prisma, vehicleId);
  if (!vehicle) notFound();

  const readings = await listOdometerReadings(prisma, vehicleId);
  const hasTrips = await vehicleHasTrips(prisma, vehicleId);
  const currentYear = new Date().getFullYear();
  const currentReading = readings.find((r) => r.taxYear === currentYear);

  const boundUpdate = updateVehicleAction.bind(null, vehicleId) as (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
  const boundOdometer = upsertOdometerAction.bind(null, vehicleId);

  return (
    <>
      <PageHeader
        title={vehicle.displayName}
        description={vehicle.description || 'Vehicle details and odometer readings.'}
        actions={
          !vehicle.isArchived ? (
            <form action={archiveVehicleAction.bind(null, vehicleId)}>
              <button type="submit" className="btn btn-secondary">
                Archive
              </button>
            </form>
          ) : undefined
        }
      />

      {!vehicle.isArchived && (
        <VehicleForm
          action={boundUpdate}
          defaults={{
            displayName: vehicle.displayName,
            description: vehicle.description,
          }}
          submitLabel="Save changes"
        />
      )}

      <div className="card mt-6">
        <h2 className="text-lg font-semibold">Odometer readings</h2>
        {readings.length > 0 && (
          <div className="table-scroll mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tax year</th>
                  <th scope="col">Start</th>
                  <th scope="col">End</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{reading.taxYear}</td>
                    <td className="font-mono">{reading.odometerYearStart ?? '—'}</td>
                    <td className="font-mono">{reading.odometerYearEnd ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!vehicle.isArchived && (
          <form action={boundOdometer} className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="tax_year" className="form-label">
                Tax year
              </label>
              <select
                id="tax_year"
                name="tax_year"
                defaultValue={currentYear}
                className="form-input"
              >
                {availableTaxYears().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="odometer_year_start" className="form-label">
                Start-of-year odometer
              </label>
              <input
                id="odometer_year_start"
                name="odometer_year_start"
                type="number"
                min="0"
                defaultValue={currentReading?.odometerYearStart ?? ''}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="odometer_year_end" className="form-label">
                End-of-year odometer
              </label>
              <input
                id="odometer_year_end"
                name="odometer_year_end"
                type="number"
                min="0"
                defaultValue={currentReading?.odometerYearEnd ?? ''}
                className="form-input"
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="btn btn-primary">
                Save odometer reading
              </button>
            </div>
          </form>
        )}
      </div>

      {!hasTrips && !vehicle.isArchived && (
        <div className="mt-6">
          <form action={deleteVehicleAction.bind(null, vehicleId)}>
            <button type="submit" className="btn btn-destructive">
              Delete vehicle
            </button>
          </form>
        </div>
      )}

      <p className="mt-4">
        <Link href="/vehicles" className="text-primary hover:underline">
          ← Back to vehicles
        </Link>
      </p>
    </>
  );
}
