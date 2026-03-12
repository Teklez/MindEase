import { getRequestConfig } from "next-intl/server";

const LOCALE_COOKIE = "NEXT_LOCALE";
const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = ["en", "am"] as const;

function isValidLocale(value: string): value is (typeof SUPPORTED_LOCALES)[number] {
  return SUPPORTED_LOCALES.includes(value as (typeof SUPPORTED_LOCALES)[number]);
}

export default getRequestConfig(async () => {
  let locale = DEFAULT_LOCALE;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const value = cookieStore.get(LOCALE_COOKIE)?.value;
    if (value && isValidLocale(value)) locale = value;
  } catch {
    // cookies() can throw outside request scope (e.g. build); keep default
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
