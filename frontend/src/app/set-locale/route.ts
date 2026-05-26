import { NextRequest } from "next/server";

const LOCALE_COOKIE = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const ALLOWED_LOCALES = ["en", "am"] as const;

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  const nextRaw = request.nextUrl.searchParams.get("next") ?? "/";
  const location = nextRaw.startsWith("/") ? nextRaw : "/";

  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });

  if (locale && ALLOWED_LOCALES.includes(locale as (typeof ALLOWED_LOCALES)[number])) {
    headers.append(
      "Set-Cookie",
      `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
    );
  }

  return new Response(null, { status: 307, headers });
}
