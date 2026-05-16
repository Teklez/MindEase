import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Browser-safe clipboard write. navigator.clipboard only exists in secure
 * contexts (Firefox treats 0.0.0.0 / bare-IP hosts as insecure), so fall
 * back to a hidden textarea + document.execCommand("copy"). Returns true
 * on success, false otherwise.
 */
export async function safeClipboardWrite(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Browser-safe UUID generator. crypto.randomUUID() only exists in secure
 * contexts (Firefox treats 0.0.0.0 / bare-IP hosts as insecure), so fall
 * back to a v4-shaped string built from Math.random when the secure API
 * isn't accessible. Good enough for client-only message ids.
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[((Math.random() * 16) | 0 & 0x3) | 0x8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

export type ConversationGroupKey = "today" | "yesterday" | "previous7" | "thisMonth" | "older";

export type GroupedConversations<T> = Record<ConversationGroupKey, { conversations: T[] }>;

function startOfDay(d: Date): number {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

function startOfMonth(d: Date): number {
  const t = new Date(d);
  t.setDate(1);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

export function groupConversationsByDate<T extends { last_message_at: string; conversation_id: string; title: string | null }>(
  conversations: T[]
): GroupedConversations<T> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 86400000;
  const previous7Start = todayStart - 7 * 86400000;
  const thisMonthStart = startOfMonth(now);

  const groups: GroupedConversations<T> = {
    today: { conversations: [] },
    yesterday: { conversations: [] },
    previous7: { conversations: [] },
    thisMonth: { conversations: [] },
    older: { conversations: [] },
  };

  const sorted = [...conversations].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  for (const c of sorted) {
    const t = new Date(c.last_message_at).getTime();
    const dayStart = startOfDay(new Date(c.last_message_at));
    if (dayStart === todayStart) groups.today.conversations.push(c);
    else if (dayStart === yesterdayStart) groups.yesterday.conversations.push(c);
    else if (t >= previous7Start) groups.previous7.conversations.push(c);
    else if (t >= thisMonthStart) groups.thisMonth.conversations.push(c);
    else groups.older.conversations.push(c);
  }

  return groups;
}

/** Format message timestamp: "2:34 PM" today, "Mon 2:34 PM" this week, "Jan 5, 2:34 PM" older */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = todayStart - 6 * 86400000;
  const t = d.getTime();
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (t >= todayStart) return timeStr;
  if (t >= weekStart) return `${d.toLocaleDateString([], { weekday: "short" })} ${timeStr}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
}
