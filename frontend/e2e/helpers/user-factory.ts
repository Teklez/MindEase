import { randomBytes } from "node:crypto";

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Build a unique fake user for a test run.
 *
 * Each test that uses an authenticated fixture gets a fresh user — that
 * keeps the DB state predictable and lets tests run in parallel without
 * stepping on each other. The randomness is deliberately short and
 * readable so failing-test artifacts (HTML report screenshots, traces)
 * stay easy to scan.
 */
export function makeTestUser(prefix = "e2e"): TestUser {
  const tag = randomBytes(5).toString("hex");
  return {
    email: `${prefix}+${tag}@example.com`,
    password: "Test1234!",
    displayName: `E2E ${tag}`,
  };
}
