import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteTripAction } from '@/app/actions/data';
import { PageHeader } from '@/components/PageHeader';
import { computeTripDeduction, formatCents, isLateEntered } from '@/lib/deductions';
import { prisma } from '@/lib/db';
import { formatRateDisplay } from '@/lib/rates';
import { formatByteSize } from '@/lib/receipts';
import { requireAuthenticatedUser } from '@/lib/session';
import { getTrip } from '@/lib/trips';
import { ReceiptUploadForm } from './ReceiptUploadForm';

interface TripDetailPageProps {
  params: { id: string };
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  await requireAuthenticatedUser();
  const tripId = parseInt(params.id, 10);
  if (Number.isNaN(tripId)) notFound();

  const trip = await getTrip(prisma, tripId);
  if (!trip) notFound();

  const deduction = await computeTripDeduction(prisma, trip);
  const late = isLateEntered(trip);

  return (
    <>
      <PageHeader
        title={`Trip — ${trip.tripDate.toISOString().slice(0, 10)}`}
        description={`${trip.origin} → ${trip.destination}`}
        actions={
          <>
            <Link href={`/trips/${trip.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
            <form action={deleteTripAction.bind(null, trip.id)}>
              <button type="submit" className="btn btn-destructive">
                Delete
              </button>
            </form>
          </>
        }
      />

      {late && (
        <div className="alert-warning">
          This trip was entered more than 7 days after the trip date and is flagged as late-entered.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold">Substantiation</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-text-secondary">Date</dt>
              <dd>{trip.tripDate.toISOString().slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Origin</dt>
              <dd>{trip.origin}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Destination</dt>
              <dd>{trip.destination}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Business purpose</dt>
              <dd>{trip.businessPurpose}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Miles</dt>
              <dd className="font-mono">{trip.miles.toString()}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Category</dt>
              <dd>{trip.category.displayName}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">Vehicle</dt>
              <dd>
                <Link href={`/vehicles/${trip.vehicle.id}`} className="text-primary hover:underline">
                  {trip.vehicle.displayName}
                </Link>
              </dd>
            </div>
            {(trip.odometerStart != null || trip.odometerEnd != null) && (
              <div>
                <dt className="text-text-secondary">Odometer</dt>
                <dd className="font-mono">
                  {trip.odometerStart ?? '—'} → {trip.odometerEnd ?? '—'}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Deduction</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-text-secondary">Applied rate</dt>
              <dd className="font-mono">
                {deduction.rateCentsPerMile != null
                  ? formatRateDisplay(deduction.rateCentsPerMile)
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Computed amount</dt>
              <dd className="font-mono text-success">
                {deduction.isDeductible ? formatCents(deduction.deductionCents) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">Recorded</dt>
              <dd>{trip.createdAt.toISOString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold">Receipts</h2>
        {trip.receipts.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">No receipts attached.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trip.receipts.map((receipt) => (
              <li key={receipt.id} className="rounded-lg border border-border p-3">
                <a href={`/api/receipts/${receipt.id}`} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/receipts/${receipt.id}`}
                    alt={receipt.originalFilename}
                    className="mb-2 h-32 w-full rounded object-cover"
                  />
                </a>
                <p className="truncate text-sm font-medium">{receipt.originalFilename}</p>
                <p className="text-xs text-text-secondary">
                  {formatByteSize(receipt.byteSize)} · {receipt.uploadedAt.toISOString().slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <ReceiptUploadForm tripId={trip.id} />
        </div>
      </div>
    </>
  );
}
