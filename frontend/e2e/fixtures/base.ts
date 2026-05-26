import { test as baseTest, expect } from "@playwright/test";

import { ApiClient } from "../helpers/api-client";

export interface BaseFixtures {
  api: ApiClient;
}

/**
 * Base test object every spec should import (instead of `@playwright/test`
 * directly) so we get the shared backend client without re-wiring it.
 *
 * Specs that need an authenticated session should import from
 * `./authenticated` — that fixture composes on top of this one.
 */
export const test = baseTest.extend<BaseFixtures>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect };
