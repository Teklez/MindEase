import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for /login. Locators target a11y attributes (labels, role,
 * autocomplete) rather than CSS classes so they survive visual redesigns.
 */
export class LoginPage extends BasePage {
  readonly path = "/login";

  get emailInput(): Locator {
    return this.page.locator("#li-email");
  }

  get passwordInput(): Locator {
    return this.page.locator("#li-password");
  }

  get submitButton(): Locator {
    return this.page.getByRole("button", { name: /sign in|continue|submit/i });
  }

  get errorAlert(): Locator {
    // Form-level error is rendered with role="alert" by RHF resolver wiring.
    return this.page.getByRole("alert");
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
