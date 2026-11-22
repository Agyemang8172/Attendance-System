/**
 * Shift-window snapshot math for the attendance row (M6, lifecycle §6, §7.1).
 *
 * Pure functions only: no database, no express. The input is a plain object
 * carrying the snapshot columns an `Attendance` row has, so the same helper
 * works inside a job transaction and could later be unit-tested with literal
 * objects.
 *
 * **O15 limitation, stated honestly:** the resolved instant is built from
 * UTC-midnight-of-`date` plus minutes, which is UTC arithmetic. The row's
 * `timezoneSnapshot` column is READ but NOT APPLIED here — applying an IANA
 * timezone to minute-of-day is the deferred business-timezone work tracked as
 * O15. Until O15 lands, a business in a non-UTC zone has its auto-clock-out
 * end instant computed in UTC; the column is already stored on every row so
 * the fix is additive, not a migration.
 */

export type AttendanceLike = {
  /** Business-local calendar date (`Attendance.date`, a UTC-midnight @db.Date). */
  date: Date;
  shiftStartMinuteSnapshot: number | null;
  shiftEndMinuteSnapshot: number | null;
  shiftCrossesMidnightSnapshot: boolean | null;
  timezoneSnapshot: string | null;
};

/**
 * Resolve the row's scheduled shift-end instant from its snapshots.
 *
 * Returns `null` — never a guess — when the end minute is missing, or when
 * the cross-midnight flag is absent AND the start minute needed to derive it
 * is missing too (legacy rows written before the snapshot columns existed).
 * The job treats a `null` as "flag for review", not "close anyway".
 */
export const resolveShiftEndInstant = (row: AttendanceLike): Date | null => {
  if (typeof row.shiftEndMinuteSnapshot !== "number") return null;

  // A cross-midnight flag snapshot may be absent on older rows even though
  // the minute snapshots exist. It is derivable: a same-day shift always ends
  // at or after its start minute, so an end minute at/before the start means
  // the window rolled past midnight (lifecycle §6 — endMinute <= startMinute
  // covers the strict overnight case; the degenerate end == start also takes
  // the +1 day branch because it cannot be a forward-moving same-day end).
  let crossesMidnight: boolean;
  if (typeof row.shiftCrossesMidnightSnapshot === "boolean") {
    crossesMidnight = row.shiftCrossesMidnightSnapshot;
  } else if (typeof row.shiftStartMinuteSnapshot === "number") {
    crossesMidnight = row.shiftEndMinuteSnapshot <= row.shiftStartMinuteSnapshot;
  } else {
    // Minutes exist for the end only; the overnight question is ambiguous,
    // and the job must not guess (lifecycle §7.1 condition 4).
    return null;
  }

  // `date` is a UTC-midnight @db.Date, so its UTC Y/M/D are the calendar day
  // the record belongs to; minute-of-day then lands the end on that day.
  const utcMidnight = Date.UTC(
    row.date.getUTCFullYear(),
    row.date.getUTCMonth(),
    row.date.getUTCDate()
  );
  const dayOffset = crossesMidnight ? 1440 : 0;

  return new Date(
    utcMidnight + (row.shiftEndMinuteSnapshot + dayOffset) * 60_000
  );
};

/** Whole-minute (millisecond-accurate) distance between two instants. */
export const minutesBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 60_000;

/**
 * Hours distance between two instants. The punch path in
 * attendanceController computes
 * `(clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)` inline, so
 * this helper repeats that exact divisor — the job's `hoursWorked` must not
 * drift from what a verified clock-out writes (same source, same float).
 * attendanceController keeps its inline copy: M6 does not edit it; folding
 * the two onto this helper is follow-up work.
 */
export const hoursBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / (1000 * 60 * 60);
