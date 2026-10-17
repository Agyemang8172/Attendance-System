import prisma from "../config/prismaClient.js";
import { Request, Response } from "express";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import { logger, logError } from "../utils/logger.js";

/**
 * Reports (M7, API contracts §10, decision O9).
 *
 * All four handlers are HR/SUPERADMIN (the gate order lives on the route, one
 * `authMiddleware → requirePasswordChange() → authorizeRole("HR","SUPERADMIN")
 * → validate(query) → handler` chain per row) and every query is tenant-scoped
 * through `callerBusinessId` — no report ever answers a cross-business SELECT.
 *
 * **Why report reads are not audited:** the established audit rule in this
 * codebase writes rows only when a change is accepted (help requests, PIN
 * resets, correction decisions); reading a report changes nothing and would
 * flood audit_logs with identical "did read this" rows. The one exception is
 * the CSV export below — it is a bulk data-egress event (O9's role-limited
 * surface), so the finished export writes ONE durable `report.exported` audit
 * row, not a row per record.
 */

// ── Range plumbing shared by the four handlers ───────────────────────────────

/**
 * The `Attendance.date` column is a UTC-midnight `@db.Date`, so a business day
 * is the interval `[midnight(day), midnight(day+1))` in UTC. `startDay` and
 * `endDayExclusive` build that inclusive range from the validator-checked
 * `YYYY-MM-DD` strings; `lt` (never `lte`) keeps the final day inside the
 * window.
 */
const dayBounds = (startDate: string, endDate: string) => {
  const startDay = new Date(`${startDate}T00:00:00.000Z`);
  const endDayExclusive = new Date(
    Date.parse(`${endDate}T00:00:00.000Z`) + 24 * 60 * 60 * 1000
  );
  return { startDay, endDayExclusive };
};

/**
 * Inclusive calendar-day count of the validated range (the strings passed this
 * regex + span check in the validator, so `Date.parse` cannot fail here).
 */
const daysInRange = (startDate: string, endDate: string): number =>
  Math.round(
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000
  ) + 1;

/** Same instant. New Date("YYYY-MM-DD") is spec-mandated UTC midnight. */
const dayMidnight = (date: string): number => Date.parse(`${date}T00:00:00.000Z`);

// ── Status-bucket mapping (one comment, per the provenance rule) ─────────────
//
// The report buckets are the schema's `AttendanceStatus` enum, one bucket per
// enumerated value, no status counted twice:
//   EARLY -> early | ON_TIME -> onTime | LATE -> late |
//   OPEN_SESSION -> openSession | CLOCK_OUT_MISSING -> missing |
//   AUTO_CLOSED -> autoClosed | REQUIRES_REVIEW -> requiresReview.
// `absent` is the one enum value NOT reported from rows: the lifecycle defines
// an absence as a (scheduled) day with no clock-in, and because the day-close
// job that would write per-day absence rows is v2-facing work (lifecycle §5.3,
// ClosureReason.ABSENT_NO_SHOW exists but nothing writes it yet), the report
// computes absence itself from missing rows — see each handler's absent
// definition, which states exactly who is counted and on which days.

type PunctualityRow = {
  group: string;
  early: number;
  onTime: number;
  late: number;
  openSession: number;
  autoClosed: number;
  missing: number;
  absent: number;
  requiresReview: number;
  total: number;
};

const emptyRow = (group: string): PunctualityRow => ({
  group,
  early: 0,
  onTime: 0,
  late: 0,
  openSession: 0,
  autoClosed: 0,
  missing: 0,
  absent: 0,
  requiresReview: 0,
  total: 0,
});

/** Adds one attendance row's status to its bucket and the running total. */
const tallyStatus = (row: PunctualityRow, status: string): void => {
  switch (status) {
    case "EARLY":
      row.early += 1;
      break;
    case "ON_TIME":
      row.onTime += 1;
      break;
    case "LATE":
      row.late += 1;
      break;
    case "OPEN_SESSION":
      row.openSession += 1;
      break;
    case "AUTO_CLOSED":
      row.autoClosed += 1;
      break;
    case "CLOCK_OUT_MISSING":
      row.missing += 1;
      break;
    case "ABSENT":
      // The enum value exists for this one case (a stored absence row, e.g.
      // written by HR or a future day-close job); it folds into the same
      // absent bucket the computed no-row absence uses, so the bucket stays
      // the single answer to "was this person absence-flagged".
      row.absent += 1;
      break;
    case "REQUIRES_REVIEW":
      row.requiresReview += 1;
      break;
    default:
      // Unreachable while the enum is closed; an unknown value must not be
      // silently dropped, so it lands in the strictest bucket.
      row.requiresReview += 1;
  }
  row.total += 1;
};

// ── 1. GET /api/reports/attendance-register ──────────────────────────────────

/**
 * Paginated register rows, newest first by date then clock-in (contracts §10
 * row 1), employee name and shift name joined in the same query (one findMany
 * with `include`, so no N+1 map lookup is needed for the names here). The
 * shift name prefers the row's own historical snapshot — the note under the
 * contracts table says a report for an old period must show the shift that
 * was in force then — and falls back to the live shift row for records that
 * predate the snapshot columns.
 */
export const attendanceRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    // Post-validate read: the zod schema coerced page/limit to numbers and
    // has already enforced the required pair, end >= start and the 190-day cap.
    const { startDate, endDate, employeeId, shiftId, page, limit } = req.query as unknown as {
      startDate: string;
      endDate: string;
      employeeId?: string;
      shiftId?: string;
      page: number;
      limit: number;
    };
    const { startDay, endDayExclusive } = dayBounds(startDate, endDate);
    const skip = (page - 1) * limit;

    const where = {
      businessId,
      date: { gte: startDay, lt: endDayExclusive },
      ...(employeeId ? { userId: employeeId } : {}),
      ...(shiftId ? { shiftId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: [{ date: "desc" as const }, { clockIn: "desc" as const }],
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          clockIn: true,
          clockOut: true,
          hoursWorked: true,
          status: true,
          sessionStatus: true,
          closureReason: true,
          requiresReviewReason: true,
          shiftId: true,
          shiftNameSnapshot: true,
          user: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          shift: { select: { id: true, name: true } },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        date: row.date,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        hoursWorked: row.hoursWorked,
        status: row.status,
        sessionStatus: row.sessionStatus,
        closureReason: row.closureReason,
        requiresReviewReason: row.requiresReviewReason,
        employee: row.user,
        // Snapshot first (historical truth), live shift row second.
        shiftName: row.shift?.name ?? row.shiftNameSnapshot ?? null,
        shiftId: row.shiftId,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "reports-register" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      // A non-Error throw must still be answered, not hang the request.
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── 2. GET /api/reports/punctuality-summary ──────────────────────────────────

/**
 * Counts of the classification buckets over `attendances.status`, grouped by
 * employee, shift or day (contracts §10 row 2). Aggregation runs in two
 * `groupBy` queries and is stitched in memory — never one aggregate query per
 * group.
 *
 * **The exact absent definition per grouping (stated, not implied):**
 * - `employee`: for every ACTIVE STAFF user in the business, absent = days in
 *   range with no attendance row for that user (the lifecycle's "no
 *   clock-in" rule, §5.3; the calendar/schedule filter — off-days, holidays,
 *   assignments — is the deferred day-close refinement, and STAFF-only is
 *   the honest stand-in for "scheduled people", since HR/SUPERADMIN do not
 *   clock in).
 * - `day`: absent per date = active STAFF users with no attendance row that
 *   date. The day grouping also tallies ONLY rows owned by active STAFF
 *   users (the same set the absence definition names) — an HR or SUPERADMIN
 *   row would otherwise inflate the status buckets and shrink the absence
 *   denominator, zeroing out real staff absences.
 * - `shift`: a missing row carries no shift, so absence cannot be attributed
 *   from nothing — the shift grouping counts only STORED `ABSENT` rows
 *   (today: none, until the day-close job writes them) and stays 0 otherwise.
 */
export const punctualitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const { startDate, endDate, groupBy } = req.query as unknown as {
      startDate: string;
      endDate: string;
      groupBy: "employee" | "shift" | "day";
    };

    const { startDay, endDayExclusive } = dayBounds(startDate, endDate);
    const where = {
      businessId,
      date: { gte: startDay, lt: endDayExclusive },
    };
    const rows: PunctualityRow[] = [];

    if (groupBy === "employee") {
      // 2 queries + 1 user map, then in-memory stitching — no per-group lookup.
      const [statusGroups, dateGroups, staff] = await Promise.all([
        prisma.attendance.groupBy({
          by: ["userId", "status"],
          where,
          _count: { _all: true },
        }),
        // Distinct (user, date) pairs: everything the absence computation needs.
        prisma.attendance.groupBy({
          by: ["userId", "date"],
          where,
          _count: { _all: true },
        }),
        prisma.user.findMany({
          where: { businessId, role: "STAFF", isActive: true },
          select: { id: true, firstName: true, lastName: true },
        }),
      ]);

      const rowsById = new Map<string, PunctualityRow>();
      const ensureRow = (id: string, name: string): PunctualityRow => {
        let row = rowsById.get(id);
        if (!row) {
          row = emptyRow(name);
          rowsById.set(id, row);
        }
        return row;
      };

      // Employees with punches first (they hold the classification counts).
      for (const g of statusGroups) {
        const staffMember = staff.find((s) => s.id === g.userId);
        // A row belongs to an employee no longer in the business map (deactivated
        // since): keep their numbers, labelled by their id rather than dropped.
        const name = staffMember
          ? `${staffMember.firstName} ${staffMember.lastName}`
          : g.userId;
        tallyStatus(ensureRow(g.userId, name), g.status);
      }

      // Absence for every staff member, punched or not (the definition above).
      const spanDays = daysInRange(startDate, endDate);
      const punchedDatesByUser = new Map<string, Set<string>>();
      for (const g of dateGroups) {
        // The @db.Date column serialises through the groupBy as a Date whose
        // UTC calendar is the business day itself.
        const key = g.date.toISOString().slice(0, 10);
        let set = punchedDatesByUser.get(g.userId);
        if (!set) {
          set = new Set();
          punchedDatesByUser.set(g.userId, set);
        }
        set.add(key);
      }
      for (const staffMember of staff) {
        const row = ensureRow(staffMember.id, `${staffMember.firstName} ${staffMember.lastName}`);
        const punched = punchedDatesByUser.get(staffMember.id)?.size ?? 0;
        row.absent += spanDays - punched;
        row.total += row.absent;
      }

      rows.push(...rowsById.values());
      rows.sort((a, b) => a.group.localeCompare(b.group));
    }

    if (groupBy === "shift") {
      // Shift labels come from the row's own snapshot (historical truth, per
      // the contracts §10 note), grouped alongside the id so one query answers
      // both "which shifts" and "what was each called then".
      const statusGroups = await prisma.attendance.groupBy({
        by: ["shiftId", "shiftNameSnapshot", "status"],
        where,
        _count: { _all: true },
      });

      const rowsByShift = new Map<string, PunctualityRow>();
      for (const g of statusGroups) {
        const id = g.shiftId ?? "no-shift";
        const label = g.shiftId ? (g.shiftNameSnapshot ?? "Unnamed shift") : "No shift";
        let row = rowsByShift.get(id);
        if (!row) {
          row = emptyRow(label);
          rowsByShift.set(id, row);
        }
        tallyStatus(row, g.status);
      }

      rows.push(...rowsByShift.values());
      rows.sort((a, b) => a.group.localeCompare(b.group));
    }

    if (groupBy === "day") {
      const spanDays = daysInRange(startDate, endDate);
      if (spanDays > 190) {
        // Unreachable behind the validator's cap; the guard keeps the bucket
        // loop bounded if that cap is ever loosened.
        res.status(400).json({ success: false, message: "Date range too long" });
        return;
      }

      // Row-ownership is the active STAFF set, read once — the same rule the
      // `employee` branch names. Non-staff rows must stay out of BOTH
      // groupBy queries: the `userId`/`date` pairs decide the absence
      // denominator per day (a manager's row would hide a real staff
      // absence), and the status buckets feed every other count and the
      // row total. The staff ids must exist before the groupBys, so this
      // read is sequential.
      const staff = await prisma.user.findMany({
        where: { businessId, role: "STAFF", isActive: true },
        select: { id: true },
      });
      const staffIds = staff.map((s) => s.id);
      const staffOnly = { ...where, userId: { in: staffIds } };

      const [statusGroups, dateGroups] = await Promise.all([
        prisma.attendance.groupBy({
          by: ["date", "status"],
          where: staffOnly,
          _count: { _all: true },
        }),
        prisma.attendance.groupBy({
          by: ["date", "userId"],
          where: staffOnly,
          _count: { _all: true },
        }),
      ]);

      const rowsByDay = new Map<string, PunctualityRow>();
      for (const g of statusGroups) {
        const key = g.date.toISOString().slice(0, 10);
        let row = rowsByDay.get(key);
        if (!row) {
          row = emptyRow(key);
          rowsByDay.set(key, row);
        }
        tallyStatus(row, g.status);
      }
      const usersWithRowByDay = new Map<string, Set<string>>();
      for (const g of dateGroups) {
        const key = g.date.toISOString().slice(0, 10);
        let set = usersWithRowByDay.get(key);
        if (!set) {
          set = new Set();
          usersWithRowByDay.set(key, set);
        }
        set.add(g.userId);
      }
      for (let i = 0; i < spanDays; i += 1) {
        const key = new Date(dayMidnight(startDate) + i * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const row = rowsByDay.get(key) ?? emptyRow(key);
        // Absent = active staff with no attendance row that date. The ids
        // fetched above are the denominator: every staffer in them who has
        // no row that day is one absence.
        const absent = staffIds.length - (usersWithRowByDay.get(key)?.size ?? 0);
        if (absent > 0) {
          row.absent += absent;
          row.total += absent;
        }
        rowsByDay.set(key, row);
      }

      rows.push(...rowsByDay.values());
      rows.sort((a, b) => a.group.localeCompare(b.group));
    }

    // groupBy is a validated closed enum, so exactly one branch above ran.
    res.status(200).json({
      success: true,
      data: { groupBy, startDate, endDate, rows },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "reports-punctuality" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── 3. GET /api/reports/exceptions ───────────────────────────────────────────

/**
 * The exception list (contracts §10 row 3). The exception set, from the
 * lifecycle (§4/§5.2/§7.1) and the `requiresReviewReason` column:
 * - attendance rows whose `status` is REQUIRES_REVIEW ("evaluation could not
 *   resolve a definite status, HR decides") or CLOCK_OUT_MISSING ("open row
 *   past its shift end, left for HR"), or which carries any
 *   `requiresReviewReason` flag (the review-flag lane the auto-close punch
 *   rules and corrections write to);
 * - attendanceAttempts whose `locationResult` is OUTSIDE or UNKNOWN (O4:
 *   outside the fence is flagged, never blocked; poor accuracy is UNKNOWN).
 * Every row carries its plain reason. The two sources are paginated as one
 * list: both counts run first, then the page slice is taken across the two
 * ordered queries so no unbounded set is ever loaded to sort in memory.
 */
export const exceptionsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const { startDate, endDate, page, limit } = req.query as unknown as {
      startDate: string;
      endDate: string;
      page: number;
      limit: number;
    };
    const { startDay, endDayExclusive } = dayBounds(startDate, endDate);
    const skip = (page - 1) * limit;

    const attendanceWhere = {
      businessId,
      date: { gte: startDay, lt: endDayExclusive },
      OR: [{ status: "REQUIRES_REVIEW" as const }, { status: "CLOCK_OUT_MISSING" as const }, { requiresReviewReason: { not: null } }],
    };
    const attemptWhere = {
      businessId,
      // Attempts carry no business-local date column, so the range test uses
      // their recorded creation instant — the honest equivalent filter.
      createdAt: { gte: startDay, lt: endDayExclusive },
      locationResult: { in: ["OUTSIDE" as const, "UNKNOWN" as const] },
    };

    const [attendanceCount, attemptCount] = await Promise.all([
      prisma.attendance.count({ where: attendanceWhere }),
      prisma.attendanceAttempt.count({ where: attemptWhere }),
    ]);
    const total = attendanceCount + attemptCount;

    // The combined page slice: attendance exceptions come first, attempts fill
    // the remainder. `take` on each query is bounded by what that source
    // actually holds, so neither read ever over-fetches.
    const attendanceTake = Math.max(0, Math.min(limit, attendanceCount - skip));
    const attemptSkip = Math.max(0, skip - attendanceCount);
    const attemptTake = Math.max(0, limit - attendanceTake - attemptSkip);

    const [attendanceRows, attemptRows] = await Promise.all([
      attendanceTake > 0
        ? prisma.attendance.findMany({
            where: attendanceWhere,
            orderBy: [{ date: "desc" as const }, { clockIn: "desc" as const }],
            skip,
            take: attendanceTake,
            select: {
              id: true,
              date: true,
              status: true,
              sessionStatus: true,
              requiresReviewReason: true,
              user: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      attemptTake > 0
        ? prisma.attendanceAttempt.findMany({
            where: attemptWhere,
            orderBy: { createdAt: "desc" as const },
            skip: attemptSkip,
            take: attemptTake,
            select: {
              id: true,
              createdAt: true,
              action: true,
              outcome: true,
              step: true,
              reason: true,
              locationResult: true,
              employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
              site: { select: { id: true, name: true } },
              kiosk: { select: { id: true, label: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const data = [
      ...attendanceRows.map((row) => ({
        kind: "ATTENDANCE" as const,
        id: row.id,
        date: row.date,
        employee: row.user,
        status: row.status,
        sessionStatus: row.sessionStatus,
        reason:
          row.requiresReviewReason ??
          (row.status === "CLOCK_OUT_MISSING"
            ? "Open session is past its shift end without a clock-out — needs HR attention"
            : "The record's status could not be resolved — needs HR review"),
      })),
      ...attemptRows.map((row) => ({
        kind: "ATTEMPT" as const,
        id: row.id,
        date: row.createdAt,
        employee: row.employee,
        action: row.action,
        outcome: row.outcome,
        step: row.step,
        kiosk: row.kiosk?.label ?? null,
        site: row.site?.name ?? null,
        locationResult: row.locationResult,
        reason: row.reason ?? "Location assessment is outside the site or could not be trusted",
      })),
    ];

    res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "reports-exceptions" });
      res.status(500).json({ success: false, message: "Server error" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// ── 4. GET /api/reports/attendance-register/export?format=csv (O9) ───────────

/**
 * O9's register columns, verbatim from the decision:
 * staff id, name, date, shift, clock-in, clock-out, total hours, status,
 * source, flags. "staff id" is the employeeCode.
 *
 * `source` is the punch's origin, derived from what the row actually records:
 * kiosk session -> KIOSK; closure reason HR_ASSISTED / CORRECTION -> same
 * name; closure reason AUTO_CLOCK_OUT -> AUTO_JOB (the flag's automatic
 * origin); anything else -> UNSPECIFIED (legacy migration rows carry neither).
 * `flags` is the row's `requiresReviewReason` (blank when none).
 */
const csvSourceFor = (createdByKioskId: string | null, closureReason: string | null): string => {
  if (createdByKioskId) return "KIOSK";
  if (closureReason === "HR_ASSISTED" || closureReason === "CORRECTION") return closureReason;
  if (closureReason === "AUTO_CLOCK_OUT") return "AUTO_JOB";
  return "UNSPECIFIED";
};

// ── O9 injection guard and CSV escaping ──────────────────────────────────────
//
// ORDER: the injection guard runs FIRST on the raw field value, escaping
// second. The guard must inspect what the cell actually says — after escaping,
// a spreadsheet treats the leading quote as inert decoration and the
// `=`/`+`/`-`/`@` formula trigger sits right behind it. Escaping never changes
// the first character of the guarded value, so applying the apostrophe prefix
// to the raw string and then quoting survives both steps.

/** O9 verbatim: a cell beginning `=`, `+`, `-` or `@` gets an apostrophe prefix. */
const injectionGuard = (raw: string): string =>
  /^[=+@-]/.test(raw) ? `'${raw}` : raw;

/** Standard CSV escaping: double the quotes, wrap only when the separators or newlines demand it. */
const escapeCsv = (raw: string): string => {
  const guarded = injectionGuard(raw);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/**
 * Times in the BUSINESS time zone (O9): the column values go through
 * `Intl.DateTimeFormat` with the business's IANA `timezone` column — DST-safe
 * by construction, since ICU maps each instant onto the zone's offset history.
 * Concurrence caveat stated honestly: attendance `date` is a UTC-midnight
 * @db.Date whose UTC calendar IS the business day, so it is printed from its
 * own parts, never round-tripped through the formatter (which could shift it).
 * A business with an unparseable zone (the column is read-side only here;
 * creation-time validation is not guaranteed) falls back to UTC.
 */
const buildBusinessDateFormatter = (timeZone: string): Intl.DateTimeFormat | null => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    // Unresolvable IANA name: UTC is the same instant, just labelled honestly.
    return null;
  }
};

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "YYYY-MM-DD HH:MM" from a formatter's parts, in whatever zone it was built for. */
const formatInstant = (formatter: Intl.DateTimeFormat, instant: Date): string => {
  const parts = formatter.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};

/** The @db.Date column's own UTC calendar is the business day — print it directly. */
const formatBusinessDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Hours carry two decimals: the same float the punch/job wrote, rounded once,
 * so a divisor artefact (7.600000000000001) never reaches the sheet.
 */
const formatHours = (hours: number): string => String(Math.round(hours * 100) / 100);

const CSV_BATCH_SIZE = 1000;

/**
 * The streamed CSV register (contracts §10 row 4, O9). Same filters as the
 * JSON register ({@link attendanceRegister}); no pagination of its own — the
 * whole bounded range streams out, in batches of {@link CSV_BATCH_SIZE}
 * (1 000 rows sit comfortably under a response buffer, so no batch balloons
 * memory, and each `findMany` stays a cheap indexed page). Paging walks a
 * stable cursor: the order keys put the unique `id` last, so
 * `cursor: { id }, skip: 1` resumes exactly where the previous batch ended.
 * Rows print oldest-first (a register is printed chronologically), unlike the
 * newest-first JSON view — a deliberate difference, not an oversight.
 *
 * After the stream finishes cleanly, ONE `report.exported` audit row is
 * written (actor + the range in `reason`; the row count and format ride
 * alongside) plus the matching pino line — the durable record of a bulk
 * egress. A stream that dies part-way (the client hung up, tracked through
 * the response's "close" event) writes NO audit row — only a pino warn with
 * the rows already sent — matching what actually left the server.
 */
export const attendanceRegisterCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      // Before any header is written a JSON answer is still possible.
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const businessId = await callerBusinessId(caller.userId);
    if (!businessId) {
      res.status(400).json({ success: false, message: "Account has no business" });
      return;
    }

    const { startDate, endDate, employeeId, shiftId, format } = req.query as unknown as {
      startDate: string;
      endDate: string;
      employeeId?: string;
      shiftId?: string;
      format?: string;
    };
    // The validator pins format to "csv" when present; present is the route's
    // only documented caller shape, absent is treated as the same thing.
    if (format !== undefined && format !== "csv") {
      res.status(400).json({ success: false, message: "format must be csv" });
      return;
    }

    const { startDay, endDayExclusive } = dayBounds(startDate, endDate);

    const where = {
      businessId,
      date: { gte: startDay, lt: endDayExclusive },
      ...(employeeId ? { userId: employeeId } : {}),
      ...(shiftId ? { shiftId } : {}),
    };

    // One lookup per request for the timezone (O9: business time zone) — never
    // per row.
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    const businessFormatter = buildBusinessDateFormatter(business?.timezone ?? "UTC");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-register-${startDate}_${endDate}.csv"`
    );
    // No manual "Transfer-Encoding: chunked" header: Node sends chunked
    // itself when a body has no Content-Length, and a hand-written header
    // can be invalid to HTTP/1.0 peers.

    // Disconnect tracking: "close" fires whenever the underlying socket
    // closes — on a hung-up client or a finished connection alike. Nothing
    // can reach the client after it, so remaining batches would be wasted
    // work and no durable audit row is earned (the record exists to say an
    // export COMPLETED, so a dead stream writes none).
    let clientGone = false;
    const onConnectionClosed = (): void => {
      clientGone = true;
    };
    res.on("close", onConnectionClosed);

    // Backpressure is honored: `res.write` returns false while its internal
    // buffer is full, so the next chunk waits for Node's "drain" event. The
    // wait also ends on "close", so a hung-up client cannot leave this
    // promise pending forever — the batch loop then sees the flag and stops.
    const writeOrDrain = async (chunk: string): Promise<void> => {
      const ok = res.write(chunk);
      if (ok) return;
      await new Promise<void>((resolve) => {
        const onDrain = (): void => {
          res.off("close", onWaitClosed);
          resolve();
        };
        const onWaitClosed = (): void => {
          res.off("drain", onDrain);
          resolve();
        };
        res.once("drain", onDrain);
        res.once("close", onWaitClosed);
      });
    };

    await writeOrDrain(
      "staff id,name,date,shift,clock-in,clock-out,total hours,status,source,flags\r\n"
    );

    let rowCount = 0;
    let cursor: { id: string } | undefined;

    for (;;) {
      // The client hung up mid-stream: stop reading batches (each findMany
      // is a real indexed query) and fall through to the abort path.
      if (clientGone) break;
      const batch = await prisma.attendance.findMany({
        where,
        orderBy: [{ date: "asc" as const }, { clockIn: "asc" as const }, { id: "asc" as const }],
        ...(cursor ? { cursor, skip: 1 } : {}),
        take: CSV_BATCH_SIZE,
        select: {
          id: true,
          date: true,
          clockIn: true,
          clockOut: true,
          hoursWorked: true,
          status: true,
          closureReason: true,
          requiresReviewReason: true,
          createdByKioskId: true,
          shiftNameSnapshot: true,
          shift: { select: { name: true } },
          user: { select: { employeeCode: true, firstName: true, lastName: true } },
        },
      });
      if (batch.length === 0) break;
      cursor = { id: batch[batch.length - 1].id };

      const lines = batch.map((row) => {
        const cells = [
          row.user.employeeCode,
          `${row.user.firstName} ${row.user.lastName}`,
          formatBusinessDate(row.date),
          row.shiftNameSnapshot ?? row.shift?.name ?? "",
          businessFormatter
            ? formatInstant(businessFormatter, row.clockIn)
            : formatInstant(utcDateTimeFormatter, row.clockIn),
          row.clockOut
            ? businessFormatter
              ? formatInstant(businessFormatter, row.clockOut)
              : formatInstant(utcDateTimeFormatter, row.clockOut)
            : "",
          formatHours(row.hoursWorked),
          row.status,
          csvSourceFor(row.createdByKioskId, row.closureReason),
          row.requiresReviewReason ?? "",
        ];
        return cells.map(escapeCsv).join(",");
      });

      // A false from `res.write` would mean the buffer backed up; writeOrDrain
      // waits it out, so the loop never pushes past what the socket accepts.
      await writeOrDrain(`${lines.join("\r\n")}\r\n`);
      rowCount += batch.length;
    }
    res.off("close", onConnectionClosed);

    if (clientGone) {
      // Aborted mid-stream: some rows may have left the server, but no
      // completed export happened, so no `report.exported` audit row is
      // written. A single pino warn is the whole record of the abort.
      logger.warn(
        {
          userId: caller.userId,
          businessId,
          report: "attendance-register",
          startDate,
          endDate,
          rowsBeforeAbort: rowCount,
          event: "report_export_aborted",
        },
        "CSV export aborted — the client disconnected before the stream finished"
      );
      return;
    }

    res.end();

    // The stream ended cleanly: one durable audit row for the export event.
    await writeAudit({
      businessId,
      action: "report.exported",
      entityType: "report",
      entityId: null,
      userId: caller.userId,
      reason: JSON.stringify({
        format: "csv",
        report: "attendance-register",
        startDate,
        endDate,
        rows: rowCount,
      }),
    });
    logger.info(
      {
        userId: caller.userId,
        businessId,
        report: "attendance-register",
        startDate,
        endDate,
        rows: rowCount,
        event: "report_exported",
      },
      "Attendance register exported as CSV"
    );
  } catch (error) {
    if (error instanceof Error) {
      logError(error, { route: "reports-register-csv" });
    }
    if (res.headersSent) {
      // Once the header row streamed out, only an abort closes the response —
      // no JSON error can be answered, and no audit row was earned.
      res.end();
      return;
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export default {
  attendanceRegister,
  punctualitySummary,
  exceptionsReport,
  attendanceRegisterCsv,
};
