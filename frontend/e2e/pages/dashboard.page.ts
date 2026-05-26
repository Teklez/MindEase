import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

export class DashboardPage extends BasePage {
  readonly path = "/dashboard";

  /** Greeting hero on the dashboard — anchors "I'm authenticated and rendered." */
  get greeting(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  get startChatCta(): Locator {
    return this.page.getByRole("link", { name: /start.*chat|talk now|begin a chat/i });
  }
}
