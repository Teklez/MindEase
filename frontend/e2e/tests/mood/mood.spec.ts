import { test, expect } from "../../fixtures/authenticated";
import { MoodPage } from "../../pages/mood.page";

test.describe("mood", () => {
  test("page renders with title, Log-your-mood CTA, and disabled Export", async ({
    authedPage,
  }) => {
    const mood = new MoodPage(authedPage);
    await mood.goto();

    await expect(mood.title).toBeVisible();
    await expect(mood.logMoodButton).toBeVisible();
    // Export starts disabled — no entries on a fresh account.
    await expect(mood.exportButton).toBeDisabled();
  });

  test("logging a mood opens the dialog, saves, and shows the success toast", async ({
    authedPage,
  }) => {
    const mood = new MoodPage(authedPage);
    await mood.goto();

    await mood.logMoodButton.click();
    await expect(mood.dialog).toBeVisible();

    // Pick "Good" and add a note.
    await mood.moodButton("Good").click();
    await mood.noteInput.fill("Tested via e2e — feeling steady today.");

    // Save reveals as soon as a mood is selected; the saved state flips the
    // label to "Mood logged!" briefly before the dialog auto-dismisses.
    await mood.saveButton.click();

    // First-time entry can trip the "first check-in" badge, so the toast
    // may render the badge name too — match loosely.
    await expect(
      authedPage.getByText(/^Mood logged!$/).first(),
    ).toBeVisible();
  });

  test("after a mood is logged, the Export button becomes enabled", async ({
    authedPage,
  }) => {
    const mood = new MoodPage(authedPage);
    await mood.goto();

    await mood.logMoodButton.click();
    await mood.moodButton("Okay").click();
    await mood.saveButton.click();

    // The dialog auto-closes ~1.2s after success. Wait for it to go away.
    await expect(mood.dialog).toBeHidden({ timeout: 8_000 });

    // Page refreshes stats — Export now reflects total_entries > 0.
    await expect(mood.exportButton).toBeEnabled({ timeout: 8_000 });
  });
});
