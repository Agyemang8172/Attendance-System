/**
 * Attendance status rule engine (M3).
 *
 * Evaluates a clock-in into one of the M2 `AttendanceStatus` enum values:
 * EARLY, ON_TIME, LATE, OPEN_SESSION, CLOCK_OUT_MISSING, AUTO_CLOSED,
 * ABSENT, REQUIRES_REVIEW.
 *
 * All times are minute-of-day. Timestamps are stored as timestamptz (UTC),
 * so the clock-in is read in UTC. Business-timezone conversion is noted as
 * follow-up work (the business timezone is not yet on the user record).
 *
 * Rules:
 *  - EARLY:  clock-in is more than `graceEarlyMinutes` before shift start
 *  - ON_TIME: clock-in is within the late grace window (start .. start+graceLate)
 *  - LATE:   clock-in is after the late grace window
 *  - OPEN_SESSION: no shift or policy to evaluate against (open, not yet classified)
 *
 * Minute-of-day is circular: the day runs 0..1439 and then wraps back to 0.
 * Every distance to the shift start is therefore measured with modular
 * arithmetic, `(a - b + 1440) % 1440`, so a shift starting at 23:55 sees a
 * 23:50 clock-in as five minutes before start rather than 23h50 after it.
 * That is what lets one formula serve both daytime shifts and shifts that
 * cross midnight (PRD §12, O15).
 */

export type AttendanceStatus =
  | "EARLY"
  | "ON_TIME"
  | "LATE"
  | "OPEN_SESSION"
  | "CLOCK_OUT_MISSING"
  | "AUTO_CLOSED"
  | "ABSENT"
  | "REQUIRES_REVIEW";

type ShiftLike = {
  startMinute: number;
  endMinute: number;
  crossesMidnight: boolean;
};

type PolicyLike = {
  graceEarlyMinutes: number;
  graceLateMinutes: number;
};

/** Minute of day (0..1439) from a Date, read in UTC. */
const minuteOfDay = (date: Date): number =>
  date.getUTCHours() * 60 + date.getUTCMinutes();

/**
 * Evaluate the status of a clock-in against its shift and policy.
 */
export const evaluateClockInStatus = (
  clockIn: Date,
  shift: ShiftLike | null,
  policy: PolicyLike | null
): AttendanceStatus => {
  if (!shift || !policy) return "OPEN_SESSION";

  const minute = minuteOfDay(clockIn);
  const { startMinute } = shift;

  // Distance to the shift start in both directions, kept in 0..1439 by the
  // wrap. A punch sitting on the timeline is always nearer to one of the two
  // starts it could belong to (the one that just passed, or the one coming
  // up); the nearer one is the shift this punch is about.
  const minutesBeforeStart = (startMinute - minute + 1440) % 1440;
  const minutesAfterStart = (minute - startMinute + 1440) % 1440;

  if (minutesBeforeStart <= minutesAfterStart) {
    // Pre-start side of the clock-in. Being within the early grace is normal
    // and classifies as on time; anything earlier than the grace is EARLY.
    // With a zero early grace any pre-start punch is EARLY.
    if (minutesBeforeStart > policy.graceEarlyMinutes) return "EARLY";
    return "ON_TIME";
  }

  // Post-start side of the clock-in: on time up to the late grace, late after.
  if (minutesAfterStart <= policy.graceLateMinutes) return "ON_TIME";
  return "LATE";
};

/**
 * Evaluate the status of an open session at clock-out time. A session still
 * open past its shift end is flagged CLOCK_OUT_MISSING; otherwise the status
 * set at clock-in stands.
 */
export const evaluateClockOutStatus = (
  clockOut: Date,
  existingStatus: AttendanceStatus,
  shift: ShiftLike | null
): AttendanceStatus => {
  if (!shift) return existingStatus;
  const minute = minuteOfDay(clockOut);
  const { startMinute, endMinute, crossesMidnight } = shift;

  if (crossesMidnight) {
    // The shift opens in the evening and its end falls after midnight. A
    // clock-out still on the opening evening (after the start minute) is an
    // ordinary departure from the shift in progress, so the clock-in status
    // stands — the missing-flag decision belongs to the next-morning side.
    if (minute > startMinute) return existingStatus;

    // Past midnight (minute <= startMinute): before the end minute the
    // session is still inside the shift; beyond it nobody recorded the
    // proper clock-out.
    if (minute <= endMinute) return existingStatus;
    return "CLOCK_OUT_MISSING";
  }

  if (minute > endMinute) return "CLOCK_OUT_MISSING";
  return existingStatus;
};
