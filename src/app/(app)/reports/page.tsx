import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import {
  availableTaxYears,
  computeYearSummary,
  formatCents,
} from '@/lib/deductions';
import { prisma } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { requireAuthenticatedUser } from '@/lib/session';

interface ReportsPageProps {
  searchParams: { year?: string };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireAuthenticatedUser();

  const years = availableTaxYears();
  const selectedYear = searchParams.year
    ? parseInt(searchParams.year, 10)
    : years[0];

  let summary = null;
  let error: string | null = null;

  try {
    summary = await computeYearSummary(prisma, selectedYear);
  } catch (err) {
    error = getErrorMessage(err);
  }

  return (
    <>
      <PageHeader
        title="Year-end reports"
        description="Deduction summary and IRS-compliant exports."
      />

      <form method="GET" className="card mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="year" className="form-label">
            Tax year
          </label>
          <select id="year" name="year" defaultValue={selectedYear} className="form-input">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          View summary
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}

      {summary && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="text-xl font-semibold">{selectedYear} summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Total miles</dt>
                  <dd className="font-mono">{summary.totalMiles.toString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Deductible miles</dt>
                  <dd className="font-mono">{summary.deductibleMiles.toString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Personal miles</dt>
                  <dd className="font-mono">{summary.personalMiles.toString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Total deduction</dt>
                  <dd className="font-mono text-success">
                    {formatCents(summary.totalDeductionCents)}
                  </dd>
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
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold">By category</h2>
              {summary.byCategory.length === 0 ? (
                <p className="mt-4 text-text-secondary">No trips recorded.</p>
              ) : (
                <div className="table-scroll mt-4">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Category</th>
                        <th scope="col">Miles</th>
                        <th scope="col">Deduction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byCategory.map((row) => (
                        <tr key={row.categoryCode}>
                          <td>{row.displayName}</td>
                          <td className="font-mono">{row.totalMiles.toString()}</td>
                          <td className="font-mono">
                            {row.isDeductible
                              ? formatCents(row.totalDeductionCents)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card mt-6">
            <h2 className="text-xl font-semibold">Export</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Download substantiation records with exact stored values.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/api/exports/csv?year=${selectedYear}`}
                className="btn btn-primary"
              >
                Download CSV
              </a>
              <a
                href={`/api/exports/pdf?year=${selectedYear}`}
                className="btn btn-secondary"
              >
                Download PDF summary
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
