const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(input: Date | string | number, now: Date = new Date()): string {
  const ts = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
  const diff = now.getTime() - ts.getTime();

  if (Number.isNaN(ts.getTime())) return "";
  if (diff < 30_000) return "just now";
  if (diff < HOUR) {
    const m = Math.max(1, Math.round(diff / MIN));
    return `${m} min${m === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return `${h} hr${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 2 * DAY) return "yesterday";
  if (diff < WEEK) {
    const d = Math.round(diff / DAY);
    return `${d} days ago`;
  }
  if (diff < 4 * WEEK) {
    const w = Math.round(diff / WEEK);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  return ts.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isToday(d: Date, now = new Date()): boolean {
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isYesterday(d: Date, now = new Date()): boolean {
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
}

export function isThisWeek(d: Date, now = new Date()): boolean {
  const diff = now.getTime() - d.getTime();
  return diff >= 0 && diff < WEEK;
}
