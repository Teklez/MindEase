import { NextRequest, NextResponse } from "next/server";

const LOCALE_COOKIE = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const ALLOWED_LOCALES = ["en", "am"] as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  if (!locale || !ALLOWED_LOCALES.includes(locale as (typeof ALLOWED_LOCALES)[number])) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const res = NextResponse.redirect(new URL(next, request.url));
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}
