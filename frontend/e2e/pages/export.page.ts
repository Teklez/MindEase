import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for `/settings/export` (PR #32 surface).
 *
 * The page lists every export surface — mood, chat (all + per-conversation),
 * assessments, and "everything" — each with a CSV and/or PDF action. We
 * verify that the controls render and that clicking one triggers a
 * download response, without parsing the binary payload.
 */
export class ExportPage extends BasePage {
  readonly path = "/settings/export";

  get heading(): Locator {
    return this.page.getByRole("heading", { level: 1, name: /export your data/i });
  }

  /** All "Download CSV" buttons (mood, chat, assessments). */
  downloadCsvButtons(): Locator {
    return this.page.getByRole("button", { name: /download csv/i });
  }

  downloadPdfButtons(): Locator {
    return this.page.getByRole("button", { name: /download pdf/i });
  }

  get exportEverything(): Locator {
    return this.page.getByRole("button", { name: /export everything/i });
  }
}
