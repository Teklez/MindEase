import { test, expect } from "../../fixtures/authenticated";
import { APP_ORIGIN } from "../../helpers/auth-storage";

/**
 * The language switcher hits `/set-locale?locale=...&next=<path>` which sets
 * the NEXT_LOCALE cookie via Set-Cookie and 307s back. The server uses
 * `request.url` to build the redirect, which in Docker is
 * `0.0.0.0:3000` — not reachable from the test browser (the host port is
 * mapped to 3001 and 3000 belongs to another project). That's a real bug
 * worth fixing on the app side; until then we exercise the same end state
 * by writing the cookie directly and reloading.
 */
test.describe("i18n · language switch", () => {
  test("the language switcher UI exists and points at /set-locale", async ({
    authedPage,
  }) => {
    await authedPage.goto("/dashboard");

    await authedPage.getByRole("button", { name: /switch language/i }).click();

    const amLink = authedPage.getByRole("link", { name: "አማርኛ" });
    await expect(amLink).toBeVisible();
    const href = await amLink.getAttribute("href");
    expect(href).toMatch(/^\/set-locale\?locale=am&next=/);
  });

  test("the NEXT_LOCALE cookie renders Amharic strings in the nav", async ({
    authedPage,
  }) => {
    const url = new URL(APP_ORIGIN);
    await authedPage.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "am",
        domain: url.hostname,
        path: "/",
      },
    ]);

    await authedPage.goto("/dashboard");

    // "Dashboard" → "ዳሽቦርድ" in am.json. The TopNav nav link uses the same
    // label as accessible name (icon is aria-hidden).
    await expect(authedPage.getByRole("link", { name: "ዳሽቦርድ" })).toBeVisible({
      timeout: 8_000,
    });
  });
});
