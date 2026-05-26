import type { Page } from "@playwright/test";

import { seedAuthToken } from "../helpers/auth-storage";
import { makeTestUser, type TestUser } from "../helpers/user-factory";

import { test as baseTest, expect } from "./base";

export interface AuthenticatedFixtures {
  testUser: TestUser;
  authedPage: Page;
}

/**
 * Spawns a freshly-registered user via the backend API and returns a Page
 * that already has the JWT in localStorage. Skips the UI login form so
 * non-auth specs can focus on what they're actually testing.
 *
 * Each test gets its own user → safe to run in parallel.
 */
export const test = baseTest.extend<AuthenticatedFixtures>({
  testUser: async ({}, use) => {
    await use(makeTestUser());
  },

  authedPage: async ({ browser, api, testUser }, use) => {
    const { access_token } = await api.register({
      email: testUser.email,
      password: testUser.password,
      display_name: testUser.displayName,
    });

    const context = await browser.newContext();
    await seedAuthToken(context, access_token);
    const page = await context.newPage();

    await use(page);

    await context.close();
  },
});

export { expect };
