import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

export class ResourcesPage extends BasePage {
  readonly path = "/resources";

  get heading(): Locator {
    return this.page.getByRole("heading", { level: 1, name: /resource library/i });
  }

  get articlesFilter(): Locator {
    return this.page.getByRole("button", { name: /^articles$/i });
  }

  get videosFilter(): Locator {
    return this.page.getByRole("button", { name: /^videos$/i });
  }

  get audioFilter(): Locator {
    return this.page.getByRole("button", { name: /^audio$/i });
  }

  /** A resource card surfaces its title as a heading. */
  cardByTitle(text: RegExp | string): Locator {
    return this.page.getByRole("heading", { level: 3, name: text });
  }
}
