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
 * A shift that crosses midnight (startMinute > endMinute) is evaluated against
 * the policy in force when it started (PRD §12, O15).
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
  const { startMinute, crossesMidnight } = shift;
  const earlyThreshold = policy.graceEarlyMinutes;
  const lateGrace = policy.graceLateMinutes;

  // A clock-in is early when it falls more than the early threshold before
  // shift start. Being a few minutes early (within the threshold) is normal
  // and classifies as on time once the grace window opens.
  const earliestEarly = startMinute - earlyThreshold;

  if (crossesMidnight) {
    // Shift spans midnight (e.g. 22:00-06:00). Evaluate relative to start.
    if (minute < earliestEarly) return "EARLY";
    if (minute <= startMinute + lateGrace) return "ON_TIME";
    return "LATE";
  }

  // Normal daytime shift: startMinute <= endMinute.
  if (minute < earliestEarly) return "EARLY";
  if (minute <= startMinute + lateGrace) return "ON_TIME";
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
  const { endMinute, crossesMidnight } = shift;

  if (crossesMidnight) {
    // After midnight, the shift end minute is smaller than start. A clock-out
    // before endMinute (after midnight) is within the shift; otherwise it ran
    // past the window.
    if (minute <= endMinute) return existingStatus;
    return "CLOCK_OUT_MISSING";
  }

  if (minute > endMinute) return "CLOCK_OUT_MISSING";
  return existingStatus;
};
