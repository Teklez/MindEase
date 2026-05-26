import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for `/mood`.
 *
 * The page shows stats + trends + a check-in CTA. The actual logger is in
 * a Dialog that opens on click; mood buttons inside the dialog are
 * identified by their aria-label (one of: Awful / Low / Okay / Good /
 * Great). Saving fires a toast and closes the dialog after ~1.2s.
 */
export class MoodPage extends BasePage {
  readonly path = "/mood";

  get title(): Locator {
    return this.page.getByRole("heading", { level: 1, name: /mood tracker/i });
  }

  get logMoodButton(): Locator {
    return this.page.getByRole("button", { name: /^log your mood$/i });
  }

  get exportButton(): Locator {
    return this.page.getByRole("button", { name: /^export$/i });
  }

  /**
   * Dialog that wraps MoodCheckIn — opens after clicking "Log your mood".
   * Named so we don't collide with the BadgeCelebration overlay that may
   * mount on top after a first-time entry unlocks a badge.
   */
  get dialog(): Locator {
    return this.page.getByRole("dialog", { name: /how are you feeling/i });
  }

  moodButton(label: "Awful" | "Low" | "Okay" | "Good" | "Great"): Locator {
    return this.dialog.getByRole("button", { name: label, exact: true });
  }

  get noteInput(): Locator {
    return this.dialog.getByPlaceholder(/add a note/i);
  }

  get saveButton(): Locator {
    return this.dialog.getByRole("button", { name: /save entry/i });
  }
}
