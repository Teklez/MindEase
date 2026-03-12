"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function Header() {
  const pathname = usePathname();
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");

  let title = tCommon("appName");
  if (pathname === "/dashboard") title = tNav("dashboard");
  else if (pathname === "/chat" || pathname?.startsWith("/chat/")) title = tNav("chat");

  return (
    <h1 className="flex-1 text-center text-base font-semibold text-foreground truncate">
      {title}
    </h1>
  );
}
