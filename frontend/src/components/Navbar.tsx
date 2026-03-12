"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearStoredToken, getMe, getStoredToken } from "@/lib/api";

const PUBLIC_PATHS = ["/", "/login", "/register"];

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "Chat" },
  { href: "#", label: "Mood Tracker", disabled: true, comingSoon: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname ?? "")) return;
    const token = getStoredToken();
    if (!token) return;
    getMe().then((res) => {
      if (res.ok) setDisplayName(res.data.display_name);
    });
  }, [pathname]);

  if (!pathname || PUBLIC_PATHS.includes(pathname)) return null;

  const handleLogout = () => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    clearStoredToken();
    router.replace("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#4A90A4] text-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-lg tracking-tight">
            MindEase
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) =>
              link.disabled ? (
                <span
                  key={link.label}
                  className="px-3 py-2 rounded-lg text-white/70 cursor-not-allowed text-sm"
                  title="Coming soon"
                >
                  {link.label}
                  {link.comingSoon && (
                    <span className="ml-1 text-xs text-white/60">(soon)</span>
                  )}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href))
                      ? "bg-white/20 text-white"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-white/90 truncate max-w-[120px]">
              {displayName ?? "…"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="rounded-lg px-3 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
              >
                Account
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 py-1 w-40 rounded-xl bg-white text-slate-800 shadow-lg z-20">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 rounded-lg"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl z-50 md:hidden animate-slide-in-right">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-4 flex flex-col gap-1">
              {navLinks.map((link) =>
                link.disabled ? (
                  <span
                    key={link.label}
                    className="px-4 py-3 rounded-xl text-slate-400 cursor-not-allowed"
                  >
                    {link.label} <span className="text-xs">(coming soon)</span>
                  </span>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-4 py-3 rounded-xl font-medium transition-colors ${
                      pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href))
                        ? "bg-[#4A90A4] text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
              <p className="text-sm text-slate-600 truncate mb-2">{displayName ?? "…"}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
