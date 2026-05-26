import { test, expect } from "../../fixtures/authenticated";
import { DashboardPage } from "../../pages/dashboard.page";

test.describe("dashboard", () => {
  test("authenticated user sees the greeting hero", async ({ authedPage, testUser }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await expect(authedPage).toHaveURL(/\/dashboard/);
    await expect(dashboard.greeting).toBeVisible();
    // Display name is rendered somewhere in the hero copy.
    await expect(authedPage.getByText(testUser.displayName).first()).toBeVisible();
  });
});
