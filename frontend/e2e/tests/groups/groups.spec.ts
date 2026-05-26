import { test, expect } from "../../fixtures/authenticated";
import { GroupsPage } from "../../pages/groups.page";

test.describe("groups", () => {
  test("fresh account lands on empty 'My Groups' with a Create CTA", async ({
    authedPage,
  }) => {
    const groups = new GroupsPage(authedPage);
    await groups.goto();

    await expect(groups.sidebarTitle).toBeVisible();
    await expect(groups.myGroupsTab).toBeVisible();
    await expect(groups.discoverTab).toBeVisible();
    await expect(groups.emptyMyGroupsCopy).toBeVisible();
  });

  test("create-group modal opens, accepts a new group, and routes to its room", async ({
    authedPage,
  }) => {
    const groups = new GroupsPage(authedPage);
    await groups.goto();

    await groups.createIconButton.click();
    await expect(groups.createDialog).toBeVisible();

    const groupName = `E2E circle ${Date.now()}`;
    await groups.nameInput.fill(groupName);
    await groups.descriptionInput.fill(
      "Group created by the e2e suite to verify the create flow end to end.",
    );

    // The category <select> is populated from the backend asynchronously —
    // wait until it has at least one real option before submitting.
    await expect
      .poll(async () => (await groups.categorySelect.locator("option").count()) > 1)
      .toBeTruthy();

    await groups.submitCreate.click();

    await expect(authedPage).toHaveURL(/\/groups\/[0-9a-f-]{36}/);
  });
});
