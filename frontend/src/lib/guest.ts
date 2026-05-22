import { apiRequest, setStoredToken, clearStoredToken } from "@/lib/api";

const GUEST_FLAG_KEY = "is_guest";

export type GuestUser = {
  user_id: string;
  email: string;
  display_name: string;
  is_verified: boolean;
  account_status: string;
  created_at: string;
};

export type GuestTokenResponse = {
  access_token: string;
  token_type: string;
  user: GuestUser;
};

/**
 * Create a guest session: POSTs /auth/guest, stores the token, and flags the
 * session as guest in localStorage. The flag is read by isGuestUser() so UI
 * can surface the upgrade banner and gate guest-restricted features.
 */
export async function loginAsGuest(): Promise<GuestTokenResponse> {
  const res = await apiRequest<GuestTokenResponse>("/api/v1/auth/guest", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(res.error ?? "Failed to start guest session");
  }
  setStoredToken(res.data.access_token);
  if (typeof window !== "undefined") {
    localStorage.setItem(GUEST_FLAG_KEY, "true");
  }
  return res.data;
}

export function isGuestUser(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_FLAG_KEY) === "true";
}

export function clearGuestFlag(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_FLAG_KEY);
}

/** Convenience: clear both the guest flag and the JWT (used on logout). */
export function clearGuestSession(): void {
  clearGuestFlag();
  clearStoredToken();
}

export type GuestUpgradePayload = {
  email: string;
  password: string;
  display_name: string;
};

/**
 * Convert the active guest session into a permanent account in place. The
 * server preserves user_id, so existing conversations/mood entries are kept.
 */
export async function upgradeGuest(
  payload: GuestUpgradePayload,
): Promise<GuestTokenResponse> {
  const res = await apiRequest<GuestTokenResponse>(
    "/api/v1/auth/guest/upgrade",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    throw new Error(res.error ?? "Failed to create account");
  }
  setStoredToken(res.data.access_token);
  clearGuestFlag();
  return res.data;
}
