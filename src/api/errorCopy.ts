// errorCopy — what a failed API call should SAY.
//
// Its own module (not fn in axios.ts) because the route suites mock
// `../api/axios` wholesale; the copy layer must survive that mock so sign-in
// screens still reach the real map in tests.
//
// M7 audit finding: screens were reading `response.data.message` raw into the
// UI. Server messages are not user-facing copy — they leak implementation
// phrases ("Access Denied", unique-index names, throttle keys). One map
// decides what a failed request says, typed-code first, then by status.
//
// Codes the backend emits today: PASSWORD_CHANGE_REQUIRED (403) and
// ACCOUNT_DEACTIVATED (401) — the 409 decided/record-changed/already-in-status
// and 429 throttled classes currently carry no code, so they are keyed by
// status here and their semantic codes are the forward contract rows the
// M8 lanes will fill in (the map keys, not the screens, own that wording).

/** Typed code → user-facing copy. */
const typedCodeMessages: Record<string, string> = {
  // 403 role/password-change family
  PASSWORD_CHANGE_REQUIRED:
    "Your account still owes a password change. Set one to continue.",
  ACCOUNT_DEACTIVATED:
    "This account has been deactivated. Ask your administrator to reactivate it.",
};

/** Status → plain-language copy, when no typed code carried the meaning. */
const statusMessages: Record<number, string> = {
  400: "That request could not be completed. Check the details and try again.",
  401: "Invalid email or password.",
  403: "You don't have permission to do that.",
  // 409 decided / record-changed / already-in-status family
  409: "That change conflicts with an earlier decision or a newer record. Refresh and check the current status before trying again.",
  // 429 throttled family
  429: "Too many attempts in a short time. Please wait a moment and try again.",
};

/** The stand-in for everything the map does not cover — never the raw body. */
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** The subset of an AxiosError the plain-language map reads. */
export interface ApiErrorShape {
  response?: {
    status?: number;
    data?: { code?: string; message?: string };
  };
}

/**
 * What a failed API call should SAY — typed code first, then status, then the
 * fallback. `error.message` and `response.data.message` never pass through,
 * so screens can render the result verbatim.
 *
 * One carve-out: the backend's two fixed contract strings — the credential
 * check ("Invalid email or password") and the login deactivation row
 * ("Account deactivated") — are constants the backend always sends the same
 * way. The raw equality check only selects which row below renders; no other
 * body copy can flow through, so no implementation detail can leak.
 */
export const describeApiError = (error: ApiErrorShape): string => {
  const body = error?.response?.data;

  const code = body?.code;
  if (code && typedCodeMessages[code]) {
    return typedCodeMessages[code];
  }

  if (body?.message === "Invalid email or password") {
    return "Invalid email or password.";
  }

  if (body?.message === "Account deactivated") {
    return typedCodeMessages.ACCOUNT_DEACTIVATED;
  }

  const status = error?.response?.status;
  if (status !== undefined && statusMessages[status]) {
    return statusMessages[status];
  }

  return FALLBACK_MESSAGE;
};
