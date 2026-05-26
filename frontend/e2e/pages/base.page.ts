import type { Locator, Page } from "@playwright/test";

/**
 * Shared base for all Page Objects. Holds the Playwright `Page` and
 * exposes a couple of conveniences (toasts, top-level navigation) that
 * any feature page might need. Keep this thin — feature-specific logic
 * belongs on the subclass.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Absolute path the page object lives at (used by `goto`). */
  abstract readonly path: string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** A radix toast announces via role="status" — handy for assertions. */
  toast(): Locator {
    return this.page.getByRole("status").first();
  }

  /** Primary nav link by visible label (matches both en + am bundles). */
  navLink(name: RegExp | string): Locator {
    return this.page.getByRole("link", { name });
  }
}
