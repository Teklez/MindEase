import type { BrowserContext } from "@playwright/test";

import { BASE_URL, TOKEN_STORAGE_KEY } from "./env";

/**
 * Seed the app's auth token into a fresh BrowserContext.
 *
 * The frontend reads the JWT from localStorage on first request. We can't
 * write localStorage until the origin is loaded, so we install an init
 * script that runs before any page script. This avoids a UI login round
 * trip in every authenticated test.
 */
export async function seedAuthToken(context: BrowserContext, token: string): Promise<void> {
  await context.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* private mode or storage-disabled origin — let the test fail loudly */
      }
    },
    { key: TOKEN_STORAGE_KEY, value: token },
  );
}

export const APP_ORIGIN = new URL(BASE_URL).origin;
