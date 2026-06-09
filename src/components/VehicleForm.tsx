'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { createVehicleAction, type ActionResult } from '@/app/actions/data';

const initialState: ActionResult = { ok: true };

export function VehicleForm({
  action,
  defaults = {},
  submitLabel = 'Save vehicle',
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  defaults?: { displayName?: string; description?: string };
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="card space-y-4">
      {state.error && <div className="alert-error">{state.error}</div>}
      <div>
        <label htmlFor="display_name" className="form-label">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          required
          defaultValue={defaults.displayName ?? ''}
          className="form-input"
        />
      </div>
      <div>
        <label htmlFor="description" className="form-label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description ?? ''}
          className="form-input"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
        <Link href="/vehicles" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
