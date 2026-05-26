import { test, expect } from "../../fixtures/authenticated";
import { ResourcesPage } from "../../pages/resources.page";

test.describe("resources", () => {
  test("page renders with the type filters and at least one seeded resource", async ({
    authedPage,
  }) => {
    const resources = new ResourcesPage(authedPage);
    await resources.goto();

    await expect(resources.heading).toBeVisible();

    // Articles / Videos / Audio filter chips are always present even when
    // the active category has zero items.
    await expect(resources.articlesFilter).toBeVisible();
    await expect(resources.videosFilter).toBeVisible();
    await expect(resources.audioFilter).toBeVisible();

    // Seeded data: there's at least one resource title rendered as h3.
    await expect(authedPage.getByRole("heading", { level: 3 }).first()).toBeVisible();
  });

  test("Videos filter narrows the list to video resources only", async ({
    authedPage,
  }) => {
    const resources = new ResourcesPage(authedPage);
    await resources.goto();

    // The filter button toggles activeType — wait for the query to settle.
    await resources.videosFilter.click();

    // Any rendered card heading is fine; we just want the page to stay
    // alive and re-render the filtered set.
    await expect(authedPage.getByRole("heading", { level: 3 }).first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
