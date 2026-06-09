import { notFound } from 'next/navigation';
import { updateTripAction, type ActionResult } from '@/app/actions/data';
import { PageHeader } from '@/components/PageHeader';
import { TripForm } from '@/components/TripForm';
import { prisma } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/session';
import { getTrip, listCategories } from '@/lib/trips';
import { listVehicles } from '@/lib/vehicles';

interface EditTripPageProps {
  params: { id: string };
}

export default async function EditTripPage({ params }: EditTripPageProps) {
  await requireAuthenticatedUser();
  const tripId = parseInt(params.id, 10);
  if (Number.isNaN(tripId)) notFound();

  const trip = await getTrip(prisma, tripId);
  if (!trip) notFound();

  const [categories, vehicles] = await Promise.all([
    listCategories(prisma),
    listVehicles(prisma),
  ]);

  const boundAction = updateTripAction.bind(null, tripId) as (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;

  return (
    <>
      <PageHeader title="Edit trip" description="Update substantiation fields." />
      <TripForm
        action={boundAction}
        categories={categories}
        vehicles={vehicles}
        defaults={{
          tripDate: trip.tripDate.toISOString().slice(0, 10),
          origin: trip.origin,
          destination: trip.destination,
          businessPurpose: trip.businessPurpose,
          miles: trip.miles.toString(),
          categoryId: trip.categoryId,
          vehicleId: trip.vehicleId,
          odometerStart: trip.odometerStart?.toString() ?? '',
          odometerEnd: trip.odometerEnd?.toString() ?? '',
        }}
        submitLabel="Save changes"
      />
    </>
  );
}
