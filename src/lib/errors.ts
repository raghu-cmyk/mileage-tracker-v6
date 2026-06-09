export class MileageTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MileageTrackerError';
  }
}

export class ValidationError extends MileageTrackerError {
  message: string;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.message = message;
  }
}

export class OdometerOrderingError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'OdometerOrderingError';
  }
}

export class VehicleHasTripsError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleHasTripsError';
  }
}

export class RateResolutionError extends MileageTrackerError {
  message: string;

  constructor(message: string) {
    super(message);
    this.name = 'RateResolutionError';
    this.message = message;
  }
}

export class RateTableValidationError extends MileageTrackerError {
  message: string;

  constructor(message: string) {
    super(message);
    this.name = 'RateTableValidationError';
    this.message = message;
  }
}

export class AuthError extends MileageTrackerError {
  message: string;
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.message = message;
    this.status = status;
  }
}

export function isValidationError(err: unknown): err is ValidationError {
  return err instanceof ValidationError;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof MileageTrackerError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred.';
}
