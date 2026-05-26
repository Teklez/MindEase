import { test, expect } from "../fixtures/base";

test.describe("smoke", () => {
  test("landing page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/mindease/i);
    // Landing has at least one h1 once hydrated.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });
});
