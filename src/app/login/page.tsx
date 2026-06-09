'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { loginAction, type ActionResult } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

const initialState: ActionResult = { ok: true };

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="card w-full max-w-md">
          <h1 className="text-2xl font-semibold text-text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Access your mileage log and year-end reports.
          </p>

          {state.error && <div className="alert-error mt-4">{state.error}</div>}

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="form-input"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-text-secondary">
            Need an account?{' '}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
