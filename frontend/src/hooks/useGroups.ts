"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGroupCategories,
  joinGroup as joinGroupApi,
  leaveGroup as leaveGroupApi,
  listGroups,
  type GroupsListFilters,
} from "@/lib/api";
import type { GroupCategory, GroupListItem } from "@/lib/types";

interface UseGroups {
  groups: GroupListItem[];
  categories: GroupCategory[];
  isLoading: boolean;
  error: string | null;
  joinGroup: (groupId: string) => Promise<{ ok: boolean; error?: string }>;
  leaveGroup: (groupId: string) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => void;
}

export function useGroups(filters: GroupsListFilters = {}): UseGroups {
  const { category, my_groups, search } = filters;
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);

  const fetchList = useCallback(async () => {
    const token = ++fetchTokenRef.current;
    setIsLoading(true);
    setError(null);
    const res = await listGroups({ category, my_groups, search });
    if (token !== fetchTokenRef.current) return;
    if (res.ok) {
      setGroups(res.data);
    } else {
      setError(res.error ?? "Failed to load groups");
    }
    setIsLoading(false);
  }, [category, my_groups, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    let cancelled = false;
    getGroupCategories().then((res) => {
      if (cancelled) return;
      if (res.ok) setCategories(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const joinGroup = useCallback(async (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.group_id === groupId
          ? { ...g, is_member: true, member_count: g.member_count + 1 }
          : g,
      ),
    );
    const res = await joinGroupApi(groupId);
    if (!res.ok) {
      setGroups((prev) =>
        prev.map((g) =>
          g.group_id === groupId
            ? {
                ...g,
                is_member: false,
                member_count: Math.max(0, g.member_count - 1),
              }
            : g,
        ),
      );
      return { ok: false, error: res.error };
    }
    return { ok: true };
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.group_id === groupId
          ? {
              ...g,
              is_member: false,
              member_count: Math.max(0, g.member_count - 1),
            }
          : g,
      ),
    );
    const res = await leaveGroupApi(groupId);
    if (!res.ok) {
      setGroups((prev) =>
        prev.map((g) =>
          g.group_id === groupId
            ? { ...g, is_member: true, member_count: g.member_count + 1 }
            : g,
        ),
      );
      return { ok: false, error: res.error };
    }
    return { ok: true };
  }, []);

  return {
    groups,
    categories,
    isLoading,
    error,
    joinGroup,
    leaveGroup,
    refresh: fetchList,
  };
}
