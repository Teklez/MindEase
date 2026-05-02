import { isThisWeek, isToday, isYesterday } from "./relative-time";

export type Groupable = {
  id: string;
  title?: string;
  updated_at?: string | Date;
  updatedAt?: string | Date;
  created_at?: string | Date;
  createdAt?: string | Date;
};

export type ConversationGroups<T> = {
  today: T[];
  yesterday: T[];
  thisWeek: T[];
  earlier: T[];
};

function pickDate(c: Groupable): Date {
  const raw = c.updated_at ?? c.updatedAt ?? c.created_at ?? c.createdAt;
  if (!raw) return new Date(0);
  return raw instanceof Date ? raw : new Date(raw);
}

export function groupConversations<T extends Groupable>(
  list: T[],
  now: Date = new Date(),
): ConversationGroups<T> {
  const groups: ConversationGroups<T> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
  const sorted = [...list].sort((a, b) => pickDate(b).getTime() - pickDate(a).getTime());
  for (const item of sorted) {
    const d = pickDate(item);
    if (isToday(d, now)) groups.today.push(item);
    else if (isYesterday(d, now)) groups.yesterday.push(item);
    else if (isThisWeek(d, now)) groups.thisWeek.push(item);
    else groups.earlier.push(item);
  }
  return groups;
}
