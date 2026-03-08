// Use empty string to hit same origin (Next.js rewrites /api to backend); otherwise full API URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const TOKEN_KEY = "mindease-access-token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  clearStoredToken();
  window.location.href = "/login";
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error?: string };

const REQUEST_TIMEOUT_MS = 20000;

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith("http") ? path : (BASE_URL ? `${BASE_URL}${path}` : path);
  const token = typeof window !== "undefined" ? getStoredToken() : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error && err.name === "AbortError"
      ? "Request timed out. Check that the API is running and reachable."
      : "Network error. Check that the API is running and CORS is allowed.";
    return { ok: false, status: 0, error: message };
  }
  clearTimeout(timeoutId);
  if (res.status === 401) {
    redirectToLogin();
    return { ok: false, status: 401 };
  }

  const text = await res.text();
  let data: T | undefined;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // non-JSON response
    }
  }

  if (!res.ok) {
    let error = res.statusText;
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail?: string | unknown[] }).detail;
      error = Array.isArray(d) ? (d[0] && typeof d[0] === "object" && "msg" in d[0] ? String((d[0] as { msg: string }).msg) : String(d)) : String(d);
    }
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: data as T };
}

export async function getMe(): Promise<ApiResponse<{ user_id: string; email: string; display_name: string; is_verified: boolean; account_status: string; created_at: string }>> {
  return apiRequest("/api/v1/auth/me");
}
