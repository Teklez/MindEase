import { test, expect } from "../../fixtures/authenticated";
import { AssessmentsPage } from "../../pages/assessments.page";

test.describe("assessments · crisis interstitial", () => {
  test("PHQ-9 Q9 above threshold triggers the interstitial; 'Come back later' returns to listing", async ({
    authedPage,
    api,
    testUser,
  }) => {
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const list = await api.listAssessments(access_token);
    const phq9 = list.find((a) => a.assessment_type === "depression");
    if (!phq9) test.fail(true, "Seed data missing PHQ-9 assessment.");

    const assessments = new AssessmentsPage(authedPage);
    await assessments.gotoTake(phq9!.assessment_id);

    // Q1..Q8: "Not at all" (option 0) — neutral answers.
    for (let i = 0; i < phq9!.question_count - 1; i++) {
      await assessments.option(0).click();
      await assessments.nextButton.click();
    }

    // Q9 (self-harm): "Several days" (option 1) — meets crisis_threshold = 1.
    // Q9 is the last question, so the action button is "See results" rather
    // than "Next" — the crisis check runs regardless of which label.
    await assessments.option(1).click();
    await assessments.seeResultsButton.click();

    // Crisis interstitial replaces the take-flow without advancing.
    await expect(assessments.crisisHeadline).toBeVisible();
    await expect(assessments.crisisComeBackButton).toBeVisible();
    await expect(assessments.crisisContinueButton).toBeVisible();

    // Trauma-informed: "Come back later" routes back to /assessments.
    await assessments.crisisComeBackButton.click();
    await expect(authedPage).toHaveURL(/\/assessments$/);
  });
});
