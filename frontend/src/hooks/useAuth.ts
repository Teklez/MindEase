"use client";

import { getStoredToken, clearStoredToken } from "@/lib/api";
import type { User } from "@/lib/types";

export function useAuth(): {
  token: string | null;
  user: User | null;
  loading: boolean;
  logout: () => void;
} {
  return {
    token: typeof window !== "undefined" ? getStoredToken() : null,
    user: null,
    loading: false,
    logout: () => {
      clearStoredToken();
      if (typeof window !== "undefined") window.location.href = "/login";
    },
  };
}
