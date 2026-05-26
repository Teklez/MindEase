import { test, expect } from "../../fixtures/base";
import { RegisterPage } from "../../pages/register.page";
import { makeTestUser } from "../../helpers/user-factory";

/**
 * Note: this spec deliberately does NOT use the `authedPage` fixture.
 * That fixture installs an `addInitScript` that re-seeds the JWT into
 * localStorage on every navigation, which would fight a logout flow —
 * after the redirect to /login the script fires again and writes the
 * token back. Registering through the UI gives us a "real" session
 * whose token is only stored once.
 */
test.describe("auth · logout", () => {
  test("logout from the user menu routes to /login and clears the token", async ({
    page,
  }) => {
    const user = makeTestUser("logout");
    const register = new RegisterPage(page);
    await register.goto();
    await register.register({
      displayName: user.displayName,
      email: user.email,
      password: user.password,
    });
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: /user menu/i }).click();
    await page.getByRole("menuitem", { name: /logout/i }).click();

    await expect(page).toHaveURL(/\/login(\?.*)?$/);

    const tokenAfter = await page.evaluate(() =>
      localStorage.getItem("mindease-access-token"),
    );
    expect(tokenAfter).toBeNull();

    // Direct visit to /dashboard now bounces back to /login.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
  });
});
