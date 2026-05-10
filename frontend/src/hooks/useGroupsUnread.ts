"use client";

import { useEffect, useState } from "react";
import { getGroupUnreadSummary, getStoredToken } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

/** Lightweight polling for the global "any group has unread" badge in the
 * top nav. WebSocket-based push would be more elegant, but the nav doesn't
 * own a socket and a per-minute poll is cheap. */
export function useGroupsUnread(): { hasUnread: boolean; count: number } {
  const [hasUnread, setHasUnread] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!getStoredToken()) return;
    let cancelled = false;

    const tick = async () => {
      const res = await getGroupUnreadSummary();
      if (cancelled) return;
      if (res.ok) {
        setHasUnread(res.data.has_unread);
        setCount(res.data.unread_group_count);
      }
    };

    void tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);

    // Re-check when the tab regains focus so users don't see a stale badge.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { hasUnread, count };
}
