import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object covering the entire assessments surface:
 *   - /assessments              (listing)
 *   - /assessments/[id]         (take flow + crisis interstitial + result)
 *
 * The take-flow keyboard shortcuts (1..N to select, Enter to advance) are
 * the load-bearing user path the redesign optimized for, so the helpers
 * expose them directly rather than re-clicking buttons in every spec.
 */
export class AssessmentsPage extends BasePage {
  readonly path = "/assessments";

  async gotoTake(assessmentId: string): Promise<void> {
    await this.page.goto(`/assessments/${assessmentId}`);
  }

  // ── Listing ───────────────────────────────────────────────────────────
  get safetyBanner(): Locator {
    return this.page.getByText(/screening tools, not a diagnosis/i);
  }

  /** Each card renders a "Begin" button on first-time, "Retake" otherwise. */
  beginButton(assessmentName: RegExp | string): Locator {
    // Card root → match by the assessment name heading, then locate sibling button.
    return this.page
      .getByRole("heading", { name: assessmentName, level: 3 })
      .locator("xpath=ancestor::div[contains(@class, 'flex')]")
      .first()
      .getByRole("button", { name: /^(begin|retake)$/i });
  }

  // ── Take flow ─────────────────────────────────────────────────────────

  /** The currently-rendered question heading (changes per question). */
  get currentQuestion(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  /** "Saved" pill appears as soon as one response is registered. */
  get savedPill(): Locator {
    return this.page.getByText("Saved", { exact: true });
  }

  /** Option buttons in the take-flow are aria-pressed when selected. */
  option(index: number): Locator {
    // Buttons live in a column under the question heading; index is 0-based.
    return this.page.locator('button[aria-pressed]').nth(index);
  }

  get nextButton(): Locator {
    return this.page.getByRole("button", { name: /^next$/i });
  }

  get backButton(): Locator {
    return this.page.getByRole("button", { name: /^back$/i });
  }

  get seeResultsButton(): Locator {
    return this.page.getByRole("button", { name: /^see results$/i });
  }

  /** Press a number key 1..N to select the Nth option via the keyboard handler. */
  async pressOptionKey(n: number): Promise<void> {
    await this.page.keyboard.press(String(n));
  }

  async pressEnter(): Promise<void> {
    await this.page.keyboard.press("Enter");
  }

  /**
   * Walk through every question of the open take-flow choosing the same
   * option index for each. Uses the click path (not keyboard) so the
   * assertion in the calling spec stays focused on the UI flow rather
   * than the shortcut implementation.
   *
   * Stops on the last question — the caller decides whether to submit.
   */
  async answerAll(optionIndex: number, questionCount: number): Promise<void> {
    for (let i = 0; i < questionCount; i++) {
      await this.option(optionIndex).click();
      if (i < questionCount - 1) {
        await this.nextButton.click();
      }
    }
  }

  // ── Crisis interstitial ───────────────────────────────────────────────
  get crisisHeadline(): Locator {
    return this.page.getByRole("heading", { name: /thank you for being.*honest/i });
  }

  get crisisComeBackButton(): Locator {
    return this.page.getByRole("button", { name: /come back later/i });
  }

  get crisisContinueButton(): Locator {
    return this.page.getByRole("button", { name: /continue check-in/i });
  }

  // ── Result view ───────────────────────────────────────────────────────
  /** Score ring inside the result view shows the numeric score. */
  get scoreNumber(): Locator {
    return this.page.getByText(/^\d+$/).first();
  }
}
