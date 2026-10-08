import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response error policy ─────────────────────────────────────────────────────
//
// One place decides what a failed response should do, so the interceptor stays
// a one-liner and the decision is coverable without navigating jsdom (which
// cannot follow a location change). Returns the path to redirect to, or null.

/** The subset of an AxiosError the policy reads. */
export interface ApiFailure {
  config?: { url?: string };
  response?: { status?: number; data?: { code?: string } };
}

export const handleApiError = (error: ApiFailure): string | null => {
  const isLoginRequest = error?.config?.url?.includes("/auth/login");

  // 401 — token expired or invalid (but NOT a failed login attempt): the
  // session is gone, throw it out and start over at the sign-in page.
  if (error?.response?.status === 401 && !isLoginRequest) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return "/login";
  }

  // M1 — a live session that still owes a password change is held on the
  // password screen instead of surfacing a generic failure. The 403 carries
  // `code: PASSWORD_CHANGE_REQUIRED`, which only the requirePasswordChange
  // middleware produces; the change-password endpoint itself never returns
  // it, so there is no loop back here. The token is kept intact.
  if (
    error?.response?.status === 403 &&
    error?.response?.data?.code === "PASSWORD_CHANGE_REQUIRED" &&
    window.location.pathname !== "/set-password"
  ) {
    return "/set-password";
  }

  return null;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const redirect = handleApiError(error);
    if (redirect) {
      window.location.href = redirect;
    }
    return Promise.reject(error);
  }
);

export default api;