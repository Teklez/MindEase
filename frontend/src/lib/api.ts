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

// Resource Library
export type ResourceFilters = {
  category?: string;
  type?: import("@/lib/types").ResourceType;
  favorites_only?: boolean;
};

export async function listResources(
  filters: ResourceFilters = {},
): Promise<ApiResponse<import("@/lib/types").ResourceListResponse>> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.type) params.set("type", filters.type);
  if (filters.favorites_only) params.set("favorites_only", "true");
  const qs = params.toString();
  return apiRequest(`/api/v1/resources${qs ? `?${qs}` : ""}`);
}

export async function getResourceCategories(): Promise<
  ApiResponse<import("@/lib/types").ResourceCategory[]>
> {
  return apiRequest("/api/v1/resources/categories");
}

export async function getResourceRecommendations(
  limit: number = 3,
): Promise<ApiResponse<import("@/lib/types").ResourceRecommendation[]>> {
  return apiRequest(`/api/v1/resources/recommendations?limit=${limit}`);
}

export async function trackResourceView(
  resourceId: string,
): Promise<ApiResponse<{ ok: boolean; new_badges: BadgeResponse[] }>> {
  return apiRequest(`/api/v1/resources/${resourceId}/view`, { method: "POST" });
}

export async function toggleResourceFavorite(
  resourceId: string,
): Promise<ApiResponse<{ is_favorite: boolean }>> {
  return apiRequest(`/api/v1/resources/${resourceId}/favorite`, { method: "POST" });
}

// Assessments
export async function listAssessments(): Promise<
  ApiResponse<import("@/lib/types").AssessmentListItem[]>
> {
  return apiRequest("/api/v1/assessments");
}

export async function getAssessment(
  assessmentId: string,
): Promise<ApiResponse<import("@/lib/types").AssessmentFull>> {
  return apiRequest(`/api/v1/assessments/${assessmentId}`);
}

export async function submitAssessment(
  assessmentId: string,
  responses: import("@/lib/types").AssessmentResponseEntry[],
): Promise<ApiResponse<import("@/lib/types").AssessmentResult>> {
  return apiRequest(`/api/v1/assessments/${assessmentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ responses }),
  });
}

export async function getAssessmentHistory(
  assessmentType?: string,
): Promise<ApiResponse<import("@/lib/types").AssessmentHistory>> {
  const qs = assessmentType ? `?assessment_type=${assessmentType}` : "";
  return apiRequest(`/api/v1/assessments/history${qs}`);
}

export async function getAssessmentResult(
  userAssessmentId: string,
): Promise<ApiResponse<import("@/lib/types").AssessmentResult>> {
  return apiRequest(`/api/v1/assessments/results/${userAssessmentId}`);
}

// Groups
export type GroupsListFilters = {
  category?: string;
  my_groups?: boolean;
  search?: string;
};

export async function getGroupCategories(): Promise<
  ApiResponse<import("@/lib/types").GroupCategory[]>
> {
  return apiRequest("/api/v1/groups/categories");
}

export async function listGroups(
  filters: GroupsListFilters = {},
): Promise<ApiResponse<import("@/lib/types").GroupListItem[]>> {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.my_groups) params.set("my_groups", "true");
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return apiRequest(`/api/v1/groups${qs ? `?${qs}` : ""}`);
}

export async function getGroup(
  groupId: string,
): Promise<ApiResponse<import("@/lib/types").GroupResponse>> {
  return apiRequest(`/api/v1/groups/${groupId}`);
}

export async function createGroup(
  payload: import("@/lib/types").GroupCreatePayload,
): Promise<ApiResponse<import("@/lib/types").GroupResponse>> {
  return apiRequest("/api/v1/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateGroup(
  groupId: string,
  payload: import("@/lib/types").GroupUpdatePayload,
): Promise<ApiResponse<import("@/lib/types").GroupResponse>> {
  return apiRequest(`/api/v1/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteGroup(groupId: string): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/groups/${groupId}`, { method: "DELETE" });
}

export async function joinGroup(
  groupId: string,
): Promise<ApiResponse<import("@/lib/types").GroupMemberResponse>> {
  return apiRequest(`/api/v1/groups/${groupId}/join`, { method: "POST" });
}

export async function leaveGroup(groupId: string): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/groups/${groupId}/leave`, { method: "POST" });
}

export async function getGroupMembers(
  groupId: string,
): Promise<ApiResponse<import("@/lib/types").GroupMemberResponse[]>> {
  return apiRequest(`/api/v1/groups/${groupId}/members`);
}

export async function muteGroupMember(
  groupId: string,
  targetUserId: string,
  mute: boolean,
): Promise<ApiResponse<{ ok: boolean; is_muted: boolean }>> {
  return apiRequest(`/api/v1/groups/${groupId}/members/${targetUserId}/mute`, {
    method: "POST",
    body: JSON.stringify({ mute }),
  });
}

export async function removeGroupMember(
  groupId: string,
  targetUserId: string,
): Promise<ApiResponse<null>> {
  return apiRequest(
    `/api/v1/groups/${groupId}/members/${targetUserId}/remove`,
    { method: "POST" },
  );
}

export async function promoteGroupMember(
  groupId: string,
  targetUserId: string,
): Promise<ApiResponse<{ ok: boolean }>> {
  return apiRequest(
    `/api/v1/groups/${groupId}/members/${targetUserId}/promote`,
    { method: "POST" },
  );
}

export async function getGroupMessages(
  groupId: string,
  options: { limit?: number; before?: string } = {},
): Promise<ApiResponse<import("@/lib/types").GroupMessageResponse[]>> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.before) params.set("before", options.before);
  const qs = params.toString();
  return apiRequest(`/api/v1/groups/${groupId}/messages${qs ? `?${qs}` : ""}`);
}

export async function deleteGroupMessage(
  groupId: string,
  messageId: string,
): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/groups/${groupId}/messages/${messageId}`, {
    method: "DELETE",
  });
}

export async function markGroupRead(
  groupId: string,
): Promise<ApiResponse<null>> {
  return apiRequest(`/api/v1/groups/${groupId}/read`, { method: "POST" });
}

export async function getGroupUnreadSummary(): Promise<
  ApiResponse<import("@/lib/types").GroupUnreadSummary>
> {
  return apiRequest("/api/v1/groups/unread-summary");
}
