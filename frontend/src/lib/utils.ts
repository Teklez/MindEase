import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
