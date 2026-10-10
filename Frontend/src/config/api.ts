/**
 * Centralized API and Socket.IO configuration for V.E.C.T.O.R frontend.
 *
 * VITE_API_BASE_URL must be the base origin only (e.g. "https://my-service.onrender.com"),
 * without "/api" or a trailing slash. This variable is public and browser-visible;
 * never place secrets in VITE_ variables.
 *
 * In development (Vite dev server on port 5173/5174), defaults to http://localhost:3001.
 * In production, VITE_API_BASE_URL must be set or the build/startup will fail clearly.
 */

/** Strip trailing slashes so URL concatenation never produces "//api". */
export function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, '');
}

export function isViteDev(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.port === '5173' || window.location.port === '5174')
  );
}

/**
 * Pure resolver function for API origin resolution.
 * Accepts an env dictionary and browser dev status for testability.
 */
export function resolveApiOriginFromEnv(
  env: { VITE_API_BASE_URL?: string; DEV?: boolean } = {},
  isDev: boolean = false
): string {
  const envValue = env.VITE_API_BASE_URL;

  // Explicitly set — use it (dev or prod)
  if (envValue !== undefined && envValue.trim() !== '') {
    return normalizeOrigin(envValue.trim());
  }

  // Vite development mode — safe localhost fallback
  if (env.DEV || isDev) {
    return 'http://localhost:3001';
  }

  // Production build without a configured backend URL — fail clearly
  throw new Error(
    '[V.E.C.T.O.R] VITE_API_BASE_URL is not set. ' +
      'The production frontend requires the Render backend URL. ' +
      'Set VITE_API_BASE_URL in the Vercel project environment variables and redeploy.'
  );
}

function resolveApiOrigin(): string {
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  // In Node.js test environments without Vite globals, fallback safely
  if (typeof window === 'undefined' && !metaEnv.VITE_API_BASE_URL && !metaEnv.DEV) {
    return 'http://localhost:3001';
  }
  return resolveApiOriginFromEnv(metaEnv, isViteDev());
}

/** Base origin for the backend (no trailing slash, no "/api" suffix). */
export const API_ORIGIN: string = resolveApiOrigin();

/** Socket.IO connection target (same origin as the REST API). */
export const SOCKET_URL: string = API_ORIGIN;

/**
 * Build an API path on the backend origin.
 * Usage: apiUrl('/api/bitcoin/status') → "https://backend.onrender.com/api/bitcoin/status"
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${cleanPath}`;
}

// Re-export helpers for testing
export { normalizeOrigin as _normalizeOrigin, isViteDev as _isViteDev };
