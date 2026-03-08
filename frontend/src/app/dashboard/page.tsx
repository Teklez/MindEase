"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearStoredToken, getMe, getStoredToken } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe().then((res) => {
      setLoading(false);
      if (!res.ok) {
        if (res.status === 401) return;
        router.replace("/login");
        return;
      }
      setDisplayName(res.data.display_name);
    });
  }, [router]);

  const handleLogout = () => {
    clearStoredToken();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (displayName === null) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">MindEase</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-xl text-slate-800">
          Welcome, {displayName}!
        </p>
      </main>
    </div>
  );
}
