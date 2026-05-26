import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for /register. Field ids on the form follow the `rg-*`
 * prefix in RegisterForm.tsx — using them keeps the selectors stable
 * across copy changes.
 */
export class RegisterPage extends BasePage {
  readonly path = "/register";

  get displayNameInput(): Locator {
    return this.page.locator("#rg-name");
  }

  get emailInput(): Locator {
    return this.page.locator("#rg-email");
  }

  get passwordInput(): Locator {
    return this.page.locator("#rg-password");
  }

  get confirmPasswordInput(): Locator {
    return this.page.locator("#rg-confirm");
  }

  get termsCheckbox(): Locator {
    return this.page.getByRole("checkbox", { name: /terms of service|privacy/i });
  }

  /**
   * The terms input is `sr-only` with a styled `<span>` peer, so a direct
   * click on the input doesn't dispatch React's change handler in Firefox.
   * The browser routes a click on the wrapping `<label>` text into a
   * synthetic input click, which works cross-browser.
   */
  get termsLabel(): Locator {
    return this.page.locator('label:has-text("I agree")');
  }

  get submitButton(): Locator {
    return this.page.getByRole("button", { name: /create|sign up|register|continue/i });
  }

  async register(opts: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.displayNameInput.fill(opts.displayName);
    await this.emailInput.fill(opts.email);
    await this.passwordInput.fill(opts.password);
    await this.confirmPasswordInput.fill(opts.password);
    await this.termsLabel.click();
    await this.submitButton.click();
  }
}
