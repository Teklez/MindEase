import { test, expect } from "../../fixtures/authenticated";
import { ExportPage } from "../../pages/export.page";

test.describe("settings/export", () => {
  test("page renders for an authenticated user", async ({ authedPage }) => {
    const exp = new ExportPage(authedPage);
    await exp.goto();

    await expect(exp.heading).toBeVisible();

    // The three primary surfaces (mood / chat / assessments) each expose
    // a CSV download — so there are at least three "Download CSV" buttons
    // on the page regardless of seed state.
    await expect(exp.downloadCsvButtons()).toHaveCount(3);
    // And one "Export everything" PDF CTA.
    await expect(exp.exportEverything).toBeVisible();
  });

  test("clicking Download CSV for mood fires an attachment response", async ({
    authedPage,
    api,
    testUser,
  }) => {
    // Seed at least one mood entry so the export has real content. The
    // backend CSV endpoint will happily return an empty file but
    // hand-waving "did it download?" against zero rows is brittle.
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    await api.logMood(access_token, 4, "e2e seed entry");

    const exp = new ExportPage(authedPage);
    await exp.goto();

    const [download] = await Promise.all([
      authedPage.waitForEvent("download", { timeout: 15_000 }),
      exp.downloadCsvButtons().first().click(),
    ]);

    // Filename should include "mood" — we don't read the file bytes since
    // CSV correctness is owned by the backend service tests.
    expect(download.suggestedFilename().toLowerCase()).toContain("mood");
  });
});
