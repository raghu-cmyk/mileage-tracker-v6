import PDFDocument from 'pdfkit';
import type { DbClient } from './db';
import {
  computeTripDeduction,
  computeYearSummary,
  formatCents,
  isLateEntered,
} from './deductions';
import { formatRateDisplay } from './rates';
import { listReceiptsForTrip, receiptReferenceSummary } from './receipts';
import { listTrips } from './trips';

export const CSV_HEADERS = [
  'date',
  'origin',
  'destination',
  'business_purpose',
  'category',
  'miles',
  'vehicle',
  'applied_rate_cents_per_mile',
  'computed_amount_cents',
  'late_entered',
  'receipt_reference',
];

export interface TripLogRow {
  date: string;
  origin: string;
  destination: string;
  businessPurpose: string;
  category: string;
  miles: string;
  vehicle: string;
  appliedRateCentsPerMile: string;
  computedAmountCents: string;
  lateEntered: string;
  receiptReference: string;
}

function yearBounds(taxYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(taxYear, 0, 1)),
    end: new Date(Date.UTC(taxYear, 11, 31)),
  };
}

export async function buildTripLogRows(db: DbClient, taxYear: number): Promise<TripLogRow[]> {
  const { start, end } = yearBounds(taxYear);
  const trips = await listTrips(db, { dateFrom: start, dateTo: end });
  const sorted = [...trips].sort(
    (a, b) => a.tripDate.getTime() - b.tripDate.getTime() || a.id - b.id
  );

  const rows: TripLogRow[] = [];
  for (const trip of sorted) {
    const deduction = await computeTripDeduction(db, trip);
    const tripReceipts = await listReceiptsForTrip(db, trip.id);
    rows.push({
      date: trip.tripDate.toISOString().slice(0, 10),
      origin: trip.origin,
      destination: trip.destination,
      businessPurpose: trip.businessPurpose,
      category: deduction.categoryDisplayName,
      miles: trip.miles.toString(),
      vehicle: trip.vehicle.displayName,
      appliedRateCentsPerMile:
        deduction.rateCentsPerMile != null ? String(deduction.rateCentsPerMile) : '',
      computedAmountCents: String(deduction.deductionCents),
      lateEntered: isLateEntered(trip) ? 'yes' : 'no',
      receiptReference: receiptReferenceSummary(tripReceipts),
    });
  }
  return rows;
}

function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function renderTripLogCsv(db: DbClient, taxYear: number): Promise<string> {
  const rows = await buildTripLogRows(db, taxYear);
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        row.origin,
        row.destination,
        row.businessPurpose,
        row.category,
        row.miles,
        row.vehicle,
        row.appliedRateCentsPerMile,
        row.computedAmountCents,
        row.lateEntered,
        row.receiptReference,
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

export async function renderYearSummaryPdf(db: DbClient, taxYear: number): Promise<Buffer> {
  const summary = await computeYearSummary(db, taxYear);
  const receiptNotes = new Map<number, string>();
  for (const row of summary.tripDeductions) {
    const tripReceipts = await listReceiptsForTrip(db, row.tripId);
    receiptNotes.set(
      row.tripId,
      tripReceipts.length ? receiptReferenceSummary(tripReceipts) : 'none on file'
    );
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(`Mileage Tracker — Tax Year ${taxYear} Summary`, { align: 'left' });
    doc.moveDown();
    doc
      .fontSize(10)
      .fillColor('#334155')
      .text(
        'Year-end mileage deduction summary for accountant review. All figures reflect stored records without rounding or omission.'
      );
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#0f172a').text('Totals');
    doc.moveDown(0.5);
    doc.fontSize(10);

    const totals: [string, string][] = [
      ['Total logged miles', summary.totalMiles.toString()],
      ['Deductible miles', summary.deductibleMiles.toString()],
      ['Personal miles (excluded)', summary.personalMiles.toString()],
      ['Total deductible amount', formatCents(summary.totalDeductionCents)],
      [
        'Business-use percentage',
        summary.businessUsePercentage != null ? `${summary.businessUsePercentage}%` : '—',
      ],
      ['Late-entered trips', String(summary.lateEnteredCount)],
    ];

    for (const [label, value] of totals) {
      doc.text(`${label}: ${value}`);
    }

    doc.moveDown();
    doc.fontSize(14).text('By category');
    doc.moveDown(0.5);
    doc.fontSize(10);

    if (summary.byCategory.length === 0) {
      doc.text('No trips recorded');
    } else {
      for (const row of summary.byCategory) {
        const amount = row.isDeductible ? formatCents(row.totalDeductionCents) : '—';
        doc.text(`${row.displayName}: ${row.totalMiles} mi — ${amount}`);
      }
    }

    doc.moveDown();
    doc.fontSize(14).text('Per-trip deductions');
    doc.moveDown(0.5);
    doc.fontSize(9);

    if (summary.tripDeductions.length === 0) {
      doc.text('No trips recorded');
    } else {
      for (const row of summary.tripDeductions) {
        const rate =
          row.rateCentsPerMile != null ? formatRateDisplay(row.rateCentsPerMile) : '—';
        const deduction = row.isDeductible ? formatCents(row.deductionCents) : '—';
        const late = row.isLateEntered ? 'yes' : 'no';
        const receiptNote = receiptNotes.get(row.tripId) ?? 'none on file';
        doc.text(
          `${row.tripDate.toISOString().slice(0, 10)} | ${row.categoryDisplayName} | ${row.miles} mi | ${rate} | ${deduction} | Late: ${late} | Receipt: ${receiptNote}`
        );
      }
    }

    doc.end();
  });
}
