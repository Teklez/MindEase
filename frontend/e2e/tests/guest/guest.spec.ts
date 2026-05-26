import { test, expect } from "../../fixtures/base";
import { makeTestUser } from "../../helpers/user-factory";

/**
 * Guest mode (PR #32) lets a visitor try MindEase without an account. The
 * CTA lives on the landing page Hero. After a guest session is provisioned
 * the dashboard renders a GuestBanner with a Sign Up button that opens the
 * UpgradeModal — fill it in and the temporary user becomes a permanent
 * account in place (user_id preserved).
 */
test.describe("guest mode", () => {
  test("Continue as Guest provisions a session and routes to the dashboard", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /continue as guest/i }).click();

    // Disclaimer dialog gates the first-time guest session.
    await expect(page.getByRole("dialog", { name: /guest mode/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /got it, let's chat/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    // The persistent banner reminds the user they're in guest mode.
    await expect(
      page.getByText(/you're in guest mode/i).first(),
    ).toBeVisible();
  });

  test("Sign Up from the guest banner upgrades the session in place", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /continue as guest/i }).click();
    await expect(page.getByRole("dialog", { name: /guest mode/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /got it, let's chat/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const user = makeTestUser("guest");
    await page.getByRole("button", { name: /^sign up$/i }).click();

    const dialog = page.getByRole("dialog", { name: /create your account/i });
    await expect(dialog).toBeVisible();

    await dialog.locator("#ug-display-name").fill(user.displayName);
    await dialog.locator("#ug-email").fill(user.email);
    await dialog.locator("#ug-password").fill(user.password);
    await dialog.locator("#ug-confirm-password").fill(user.password);
    await dialog.getByRole("button", { name: /^create account$/i }).click();

    // Upgrade clears the guest flag; banner disappears.
    await expect(
      page.getByText(/you're in guest mode/i),
    ).toHaveCount(0, { timeout: 10_000 });
  });
});
