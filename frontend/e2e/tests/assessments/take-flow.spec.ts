import { test, expect } from "../../fixtures/authenticated";
import { AssessmentsPage } from "../../pages/assessments.page";

test.describe("assessments · take flow", () => {
  test("answering every GAD-7 question routes to the result view", async ({
    authedPage,
    api,
    testUser,
  }) => {
    // Resolve the GAD-7 (anxiety) assessment id without hardcoding — seed
    // data UUIDs differ per environment.
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const list = await api.listAssessments(access_token);
    const gad7 = list.find((a) => a.assessment_type === "anxiety");
    if (!gad7) test.fail(true, "Seed data missing GAD-7 assessment.");

    const assessments = new AssessmentsPage(authedPage);
    await assessments.gotoTake(gad7!.assessment_id);

    await expect(assessments.currentQuestion).toBeVisible();

    // Pick "Not at all" (option 0) for every question — keeps the score at 0,
    // which lands the user in the "minimal" feedback band without tripping
    // any crisis or warning paths (GAD-7 has no crisis question anyway).
    await assessments.answerAll(0, gad7!.question_count);

    // "Saved" appears after the first response is logged.
    await expect(assessments.savedPill).toBeVisible();

    // Last question swaps Next → See results.
    await expect(assessments.seeResultsButton).toBeVisible();
    await assessments.seeResultsButton.click();

    // Result view: score-ring "0" is visible, plus a severity callout.
    await expect(authedPage.getByText(/result/i).first()).toBeVisible();
    await expect(authedPage.getByText(/^0$/).first()).toBeVisible();
  });

  test("number keys + Enter walk through the flow", async ({
    authedPage,
    api,
    testUser,
  }) => {
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const list = await api.listAssessments(access_token);
    const gad7 = list.find((a) => a.assessment_type === "anxiety");
    if (!gad7) test.fail(true, "Seed data missing GAD-7 assessment.");

    const assessments = new AssessmentsPage(authedPage);
    await assessments.gotoTake(gad7!.assessment_id);

    await expect(assessments.currentQuestion).toBeVisible();

    for (let i = 0; i < gad7!.question_count; i++) {
      await assessments.pressOptionKey(1); // selects option index 0
      await assessments.pressEnter();
    }

    // After Enter on the last question, submit runs and we end up on the
    // result view — the score ring becomes visible.
    await expect(authedPage.getByText(/result/i).first()).toBeVisible();
  });
});
