import { test, expect } from "../../fixtures/base";
import { RegisterPage } from "../../pages/register.page";
import { makeTestUser } from "../../helpers/user-factory";

test.describe("auth · register", () => {
  test("creates a new account and lands on the dashboard", async ({ page }) => {
    const user = makeTestUser();
    const register = new RegisterPage(page);

    await register.goto();
    await register.register({
      displayName: user.displayName,
      email: user.email,
      password: user.password,
    });

    await expect(page).toHaveURL(/\/dashboard/);
  });
});
