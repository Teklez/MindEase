// Single source of truth for environment-driven test config.
// All other modules read from here so we never sprinkle process.env lookups.

function readEnv(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

export const BASE_URL = readEnv("E2E_BASE_URL", "http://localhost:3001");
export const API_URL = readEnv("E2E_API_URL", "http://localhost:8000");
export const API_PREFIX = "/api/v1";

// Browser localStorage key the app uses to persist the JWT.
// Must mirror TOKEN_KEY in src/lib/api.ts.
export const TOKEN_STORAGE_KEY = "mindease-access-token";

// Cookie name next-intl uses to remember the active locale.
export const LOCALE_COOKIE = "MINDEASE_LOCALE";
