const TOKEN_KEY = "mindease_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; status: number; error: string };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

async function req<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    if (!location.pathname.endsWith("/login")) location.href = "/login";
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text };
  }
  const data = (await res.json()) as T;
  return { ok: true, data };
}

export type Me = { user_id: string; email: string; display_name: string; is_admin: boolean; account_status: string };
export type AdminStats = {
  total_users: number; active_users_30d: number; new_users_7d: number;
  total_conversations: number; total_messages: number; total_mood_entries: number;
  total_assessments_taken: number; total_groups: number;
  crisis_conversations: number; crisis_messages: number;
};
export type AdminUser = {
  user_id: string; email: string; display_name: string; account_status: string;
  is_admin: boolean; is_verified: boolean; oauth_provider: string | null;
  created_at: string | null; last_login: string | null;
};
export type UserDetail = AdminUser & {
  stats: {
    conversations: number; mood_entries: number; assessments: number;
    crisis_conversations: number; avg_mood: number | null;
  };
};
export type ChartPoint = { date: string; count: number };
export type ActivityItem = {
  type: "signup" | "crisis" | "assessment";
  timestamp: string | null;
  user_id?: string; user_email?: string; user_name?: string;
  message_id?: string; conversation_id?: string;
  score?: number; level?: string;
};
export type GroupRow = {
  group_id: string; name: string; category: string | null;
  is_public: boolean; is_active: boolean; max_members: number; member_count: number;
  created_at: string | null;
};
export type ResourceRow = {
  resource_id: string; title: string; category: string | null;
  resource_type: string; is_active: boolean; url: string | null; duration: string | null;
};
export type GroupMemberRow = {
  user_id: string; email: string | null; display_name: string | null;
  role: string; is_muted: boolean; joined_at: string | null;
};
export type AssessmentRow = {
  assessment_id: string; name: string; assessment_type: string;
  estimated_time: string | null; question_count: number; is_active: boolean;
  times_taken: number;
};
export type BadgeRow = {
  badge_id: string; name: string; description: string;
  criteria_type: string; criteria_value: number; is_active: boolean;
  times_earned: number;
};

export const api = {
  login: (email: string, password: string) =>
    req<{ access_token: string; user: Me }>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => req<Me>("/api/v1/auth/me"),
  stats: () => req<AdminStats>("/api/v1/admin/stats"),
  signupsChart: (days = 14) => req<{ series: ChartPoint[] }>(`/api/v1/admin/signups-chart?days=${days}`),
  activity: () => req<{ items: ActivityItem[] }>("/api/v1/admin/activity"),
  users: (params: { page?: number; q?: string; status?: string; role?: string } = {}) => {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? 1));
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.role) qs.set("role", params.role);
    return req<{ total: number; page: number; limit: number; users: AdminUser[] }>(`/api/v1/admin/users?${qs}`);
  },
  userDetail: (id: string) => req<UserDetail>(`/api/v1/admin/users/${id}`),
  updateUser: (id: string, body: { account_status?: string; is_admin?: boolean }) =>
    req<AdminUser>(`/api/v1/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  groups: (page = 1) => req<{ total: number; page: number; limit: number; groups: GroupRow[] }>(`/api/v1/admin/groups?page=${page}`),
  updateGroup: (id: string, body: { is_active?: boolean }) =>
    req<GroupRow>(`/api/v1/admin/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  resources: () => req<{ resources: ResourceRow[] }>("/api/v1/admin/resources"),
  createResource: (body: {
    title: string; description: string; resource_type: string;
    category: string; url: string; duration?: string; thumbnail_url?: string;
  }) => req<{ resource_id: string; title: string }>("/api/v1/admin/resources", { method: "POST", body: JSON.stringify(body) }),
  updateResource: (id: string, body: { is_active?: boolean }) =>
    req<ResourceRow>(`/api/v1/admin/resources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  // Destructive / action endpoints (metadata-only — never read content)
  deleteUser: (id: string) => req<{ deleted: boolean }>(`/api/v1/admin/users/${id}`, { method: "DELETE" }),
  clearUserMemory: (id: string) => req<{ deleted_rows: number }>(`/api/v1/admin/users/${id}/memory`, { method: "DELETE" }),
  deleteConversation: (id: string) => req<{ deleted: boolean }>(`/api/v1/admin/conversations/${id}`, { method: "DELETE" }),
  groupMembers: (id: string) => req<{ group_name: string; members: GroupMemberRow[] }>(`/api/v1/admin/groups/${id}/members`),
  removeMember: (groupId: string, userId: string) =>
    req<{ removed: boolean }>(`/api/v1/admin/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
  deleteGroup: (id: string) => req<{ deleted: boolean }>(`/api/v1/admin/groups/${id}`, { method: "DELETE" }),
  assessments: () => req<{ assessments: AssessmentRow[] }>("/api/v1/admin/assessments"),
  generateAssessment: (prompt: string) =>
    req<{
      spec?: {
        name: string; description: string; assessment_type: string;
        icon?: string; estimated_time?: string;
        response_scale: "likert_0_3" | "likert_0_4" | "likert_1_5";
        questions: string[];
        ranges: { min: number; max: number; level: string; label: string; feedback: string }[];
      };
      refusal?: string;
    }>("/api/v1/admin/assessments/generate", { method: "POST", body: JSON.stringify({ prompt }) }),
  createAssessment: (body: {
    name: string; description: string; assessment_type: string;
    icon: string; estimated_time: string | null;
    questions: string[]; response_options: { value: number; label: string }[];
    ranges: { min: number; max: number; level: string; label: string; feedback: string; color?: string }[];
  }) => req<{ assessment_id: string; name: string }>("/api/v1/admin/assessments", { method: "POST", body: JSON.stringify(body) }),
  updateAssessment: (id: string, body: { is_active?: boolean }) =>
    req<AssessmentRow>(`/api/v1/admin/assessments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  badges: () => req<{ badges: BadgeRow[] }>("/api/v1/admin/badges"),
  createBadge: (body: {
    name: string; description: string; icon: string;
    criteria_type: string; criteria_value: number;
  }) => req<{ badge_id: string; name: string }>("/api/v1/admin/badges", { method: "POST", body: JSON.stringify(body) }),
  updateBadge: (id: string, body: { is_active?: boolean }) =>
    req<BadgeRow>(`/api/v1/admin/badges/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
