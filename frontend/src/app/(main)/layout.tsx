"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { getStoredToken, getMe } from "@/lib/api";
import TopNav from "@/components/layout/TopNav";

function isMainPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/chat") || pathname.startsWith("/mood") || pathname.startsWith("/resources");
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (!pathname || !isMainPath(pathname)) return;
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    getMe().then((res) => {
      if (!res.ok && res.status === 401) router.replace("/login");
    });
  }, [pathname, router]);

  if (!pathname || !isMainPath(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:m-0 focus-visible:w-auto focus-visible:h-auto focus-visible:p-4 focus-visible:overflow-visible focus-visible:whitespace-normal focus-visible:[clip:auto] focus-visible:rounded-md focus-visible:bg-primary focus-visible:text-primary-foreground focus-visible:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tCommon("skipToContent")}
      </a>
      <TopNav />
      <main id="main-content" className="flex flex-1 flex-col min-h-0 overflow-auto" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
