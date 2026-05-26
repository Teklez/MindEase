import { test, expect } from "../../fixtures/authenticated";
import { AssessmentsPage } from "../../pages/assessments.page";

test.describe("assessments · listing", () => {
  test("authed user sees safety banner and three validated tools", async ({
    authedPage,
  }) => {
    const assessments = new AssessmentsPage(authedPage);
    await assessments.goto();

    await expect(authedPage).toHaveURL(/\/assessments$/);
    await expect(assessments.safetyBanner).toBeVisible();

    // All three seed assessments must render as cards.
    for (const name of [/Anxiety Assessment/, /Depression Screening/, /Stress Level Check/]) {
      await expect(authedPage.getByRole("heading", { level: 3, name })).toBeVisible();
    }

    // Each card shows "Begin" on a fresh account (no prior takes).
    await expect(authedPage.getByRole("button", { name: /^begin$/i })).toHaveCount(3);
  });
});
