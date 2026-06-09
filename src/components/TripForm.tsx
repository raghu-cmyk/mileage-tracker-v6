'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { createTripAction, type ActionResult } from '@/app/actions/data';

interface Category {
  id: number;
  displayName: string;
}

interface Vehicle {
  id: number;
  displayName: string;
}

interface TripFormProps {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  categories: Category[];
  vehicles: Vehicle[];
  defaults?: {
    tripDate?: string;
    origin?: string;
    destination?: string;
    businessPurpose?: string;
    miles?: string;
    categoryId?: number;
    vehicleId?: number;
    odometerStart?: string;
    odometerEnd?: string;
  };
  submitLabel?: string;
}

const initialState: ActionResult = { ok: true };

export function TripForm({
  action,
  categories,
  vehicles,
  defaults = {},
  submitLabel = 'Save trip',
}: TripFormProps) {
  const [state, formAction] = useFormState(action, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="card space-y-4">
      {state.error && <div className="alert-error">{state.error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="trip_date" className="form-label">
            Trip date
          </label>
          <input
            id="trip_date"
            name="trip_date"
            type="date"
            required
            max={today}
            defaultValue={defaults.tripDate ?? today}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="vehicle_id" className="form-label">
            Vehicle
          </label>
          <select
            id="vehicle_id"
            name="vehicle_id"
            required
            defaultValue={defaults.vehicleId ?? ''}
            className="form-input"
          >
            <option value="" disabled>
              Select vehicle
            </option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="origin" className="form-label">
            Origin
          </label>
          <input
            id="origin"
            name="origin"
            type="text"
            required
            defaultValue={defaults.origin ?? ''}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="destination" className="form-label">
            Destination
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            required
            defaultValue={defaults.destination ?? ''}
            className="form-input"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="business_purpose" className="form-label">
            Business purpose
          </label>
          <textarea
            id="business_purpose"
            name="business_purpose"
            required
            rows={3}
            defaultValue={defaults.businessPurpose ?? ''}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="miles" className="form-label">
            Miles
          </label>
          <input
            id="miles"
            name="miles"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={defaults.miles ?? ''}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="category_id" className="form-label">
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            required
            defaultValue={defaults.categoryId ?? ''}
            className="form-input"
          >
            <option value="" disabled>
              Select category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="odometer_start" className="form-label">
            Odometer start (optional)
          </label>
          <input
            id="odometer_start"
            name="odometer_start"
            type="number"
            min="0"
            defaultValue={defaults.odometerStart ?? ''}
            className="form-input"
          />
        </div>
        <div>
          <label htmlFor="odometer_end" className="form-label">
            Odometer end (optional)
          </label>
          <input
            id="odometer_end"
            name="odometer_end"
            type="number"
            min="0"
            defaultValue={defaults.odometerEnd ?? ''}
            className="form-input"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        <Link href="/trips" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
