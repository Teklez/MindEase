import { test, expect } from "../../fixtures/base";
import { LoginPage } from "../../pages/login.page";
import { makeTestUser } from "../../helpers/user-factory";

test.describe("auth · login", () => {
  test("valid credentials route to the dashboard", async ({ page, api }) => {
    const user = makeTestUser();
    await api.register({
      email: user.email,
      password: user.password,
      display_name: user.displayName,
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, user.password);

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("invalid credentials surface an error and stay on /login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("nobody@example.com", "WrongPass1!");

    await expect(page).toHaveURL(/\/login/);
    // A toast or inline alert — either is acceptable as long as something
    // user-visible appears within the action timeout.
    await expect(
      page.getByText(/invalid|incorrect|wrong|check.*credentials/i).first(),
    ).toBeVisible();
  });
});
