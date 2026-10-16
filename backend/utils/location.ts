/**
 * Pure location assessment (kiosk spec §6, O4) — no database, no express.
 *
 * Coordinates go in, one assessment comes out:
 *
 * - INSIDE  — a fresh, plausible position within the site's geo-fence radius.
 * - OUTSIDE — a fresh, plausible position beyond the radius; flagged for
 *             review, never blocked (§6.3). A position that lands within the
 *             small near-miss margin past the radius carries `nearMiss`,
 *             because GPS jitter that close to the line is ordinary.
 * - UNKNOWN — no position, an implausible field, or a capture too stale to
 *             trust. Poor accuracy is UNKNOWN, never OUTSIDE (§6.2): a coarse
 *             fix is not evidence that the employee is away from the site.
 *
 * This is a flag, never a block. The thresholds are provisional pending R1
 * (the owner still owes the final accuracy and staleness numbers), so they are
 * the plan's documented defaults — accuracy 1..500 m, capture at most 60 s
 * old, near-miss margin 25 m — kept as named constants so R1 lands in one
 * place.
 */

/** R1 provisional default: a position captured more than this ago is stale. */
export const LOCATION_STALENESS_MS = 60 * 1000;

/** R1 provisional default: outside this window, accuracy stops being plausible. */
export const LOCATION_ACCURACY_MAX_METERS = 500;

/** Near-miss margin: OUTSIDE just past the radius, GPS jitter is ordinary. */
export const LOCATION_NEAR_MISS_MARGIN_METERS = 25;

const EARTH_RADIUS_METERS = 6371000;

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lng points, in meters (haversine).
 * Errors from assuming a spherical earth are far below the thresholds here.
 */
export const haversineDistanceMeters = (
  pointA: { latitude: number; longitude: number },
  pointB: { latitude: number; longitude: number }
): number => {
  const dLat = toRad(pointB.latitude - pointA.latitude);
  const dLng = toRad(pointB.longitude - pointA.longitude);
  const lat1 = toRad(pointA.latitude);
  const lat2 = toRad(pointB.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  // Math.min clamps the argument: floating-point error can push `a` a hair
  // past 1, which would make asin return NaN on antipodal points.
  return (
    2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)))
  );
};

/**
 * The assessment an attempt records (`AttendanceAttempt.locationResult`).
 * The values match the `LocationResult` Prisma enum, so the string passes
 * straight into the create calls.
 */
export type LocationResultValue = "INSIDE" | "OUTSIDE" | "UNKNOWN";

export type LocationAssessment = {
  result: LocationResultValue;
  /** Plain English: why this result, so the review flag reads on its own. */
  reason: string;
  /** True only for OUTSIDE within the near-miss margin of the radius. */
  nearMiss: boolean;
  /** Distance from the site centre; null whenever the position is unusable. */
  distanceMeters: number | null;
};

const unknown = (reason: string): LocationAssessment => ({
  result: "UNKNOWN",
  reason,
  nearMiss: false,
  distanceMeters: null,
});

export type KioskGeoSite = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  name?: string;
};

export type ReportedPosition = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  capturedAt?: Date | string | number;
};

const plausibleCoordinates = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export const assessLocation = (
  kioskSite: KioskGeoSite | null,
  point: ReportedPosition | null
): LocationAssessment => {
  // No site paired to the kiosk: there is no fence to evaluate against.
  if (!kioskSite) {
    return unknown("no site paired");
  }

  if (
    kioskSite.radiusMeters <= 0 ||
    !plausibleCoordinates(kioskSite.latitude, kioskSite.longitude)
  ) {
    return unknown("the site's geo-fence is not usable");
  }

  // No position at all: recorded, not invented.
  if (!point) {
    return unknown("no position reported");
  }

  const { latitude, longitude, accuracyMeters } = point;

  if (
    latitude === undefined ||
    longitude === undefined ||
    !plausibleCoordinates(latitude, longitude)
  ) {
    return unknown("the position is missing or out of range");
  }

  if (
    accuracyMeters !== undefined &&
    (accuracyMeters <= 0 || accuracyMeters > LOCATION_ACCURACY_MAX_METERS)
  ) {
    return unknown("the reported accuracy is not plausible");
  }

  if (point.capturedAt !== undefined) {
    const capturedAt = new Date(point.capturedAt);
    if (Number.isNaN(capturedAt.getTime())) {
      return unknown("the capture time is not a valid timestamp");
    }
    const now = Date.now();
    if (capturedAt.getTime() > now) {
      return unknown("the capture time is in the future");
    }
    if (now - capturedAt.getTime() > LOCATION_STALENESS_MS) {
      return unknown("the capture is too stale to trust");
    }
  }

  const distanceMeters = haversineDistanceMeters(
    { latitude, longitude },
    kioskSite
  );

  if (distanceMeters <= kioskSite.radiusMeters) {
    return {
      result: "INSIDE",
      reason: "within the site's geo-fence",
      nearMiss: false,
      distanceMeters,
    };
  }

  if (distanceMeters <= kioskSite.radiusMeters + LOCATION_NEAR_MISS_MARGIN_METERS) {
    return {
      result: "OUTSIDE",
      reason: "outside the fence by less than the near-miss margin",
      nearMiss: true,
      distanceMeters,
    };
  }

  return {
    result: "OUTSIDE",
    reason: "outside the site's geo-fence",
    nearMiss: false,
    distanceMeters,
  };
};
