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
    // Only redirect to login on 401 when it's not the login/register request (e.g. expired token on protected page)
    if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/register")) {
      redirectToLogin();
    }
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: data as T };
}

export async function getMe(): Promise<ApiResponse<{ user_id: string; email: string; display_name: string; is_verified: boolean; account_status: string; created_at: string }>> {
  return apiRequest("/api/v1/auth/me");
}

// Chat API types
export type ConversationResponse = {
  conversation_id: string;
  user_id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
  status: string;
  total_messages: number;
  crisis_detected: boolean;
};

export type MessageResponse = {
  message_id: string;
  conversation_id: string;
  sender_type: string;
  content: string;
  detected_emotion: string | null;
  timestamp: string;
  is_crisis_flagged: boolean;
};

export type ConversationWithMessages = ConversationResponse & {
  messages: MessageResponse[];
};

export async function getChatConversations(): Promise<ApiResponse<ConversationResponse[]>> {
  return apiRequest("/api/v1/chat/conversations");
}

export async function createConversation(title?: string | null): Promise<ApiResponse<ConversationResponse>> {
  return apiRequest("/api/v1/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title: title ?? null }),
  });
}

export async function getConversation(conversationId: string): Promise<ApiResponse<ConversationWithMessages>> {
  return apiRequest(`/api/v1/chat/conversations/${conversationId}`);
}

export async function updateConversation(
  conversationId: string,
  title: string | null
): Promise<ApiResponse<ConversationResponse>> {
  return apiRequest(`/api/v1/chat/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function archiveConversation(conversationId: string): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/chat/conversations/${conversationId}`, { method: "DELETE" });
}

// Mood API types
export type MoodEntryResponse = {
  entry_id: string;
  user_id: string;
  mood_level: number;
  note: string | null;
  entry_source: string;
  created_at: string;
};

export type BadgeResponse = {
  badge_id: string;
  name: string;
  name_am: string | null;
  description: string;
  description_am: string | null;
  icon: string;
  earned_at: string | null;
  is_earned: boolean;
};

export async function createMoodEntry(
  mood_level: number,
  note?: string
): Promise<ApiResponse<{ entry: MoodEntryResponse; new_badges: BadgeResponse[] }>> {
  return apiRequest("/api/v1/mood/entries", {
    method: "POST",
    body: JSON.stringify({ mood_level, note: note ?? null }),
  });
}

export async function getMoodBadges(): Promise<ApiResponse<BadgeResponse[]>> {
  return apiRequest("/api/v1/mood/badges");
}

export async function getMoodHistory(days: number = 90): Promise<ApiResponse<import("@/lib/types").MoodHistoryResponse>> {
  return apiRequest(`/api/v1/mood/history?days=${days}`);
}

export async function getMoodTrends(days: number): Promise<ApiResponse<import("@/lib/types").MoodTrend[]>> {
  return apiRequest(`/api/v1/mood/trends?days=${days}`);
}

export async function getMoodCalendar(year: number, month: number): Promise<ApiResponse<import("@/lib/types").MoodDayAggregate[]>> {
  return apiRequest(`/api/v1/mood/calendar/${year}/${month}`);
}

export async function deleteMoodEntry(entryId: string): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/mood/entries/${entryId}`, { method: "DELETE" });
}
