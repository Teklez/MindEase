import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for the `/avatar` surface.
 *
 * The picker is straightforward DOM; the viewer mounts a heavy TalkingHead
 * + Three.js + AudioWorklet pipeline that we deliberately don't wait on in
 * E2E (slow, WebGL-dependent, non-deterministic). Specs verify the routing
 * shell — "did we land on the viewer?" — and leave streaming behaviour to
 * a separate manual-QA loop.
 */
export class AvatarPage extends BasePage {
  readonly path = "/avatar";

  get title(): Locator {
    return this.page.getByRole("heading", { name: /who would you like to talk with/i });
  }

  /** Persona cards expose role="button" via AvatarScene's outer Card div. */
  personaCard(name: RegExp | string): Locator {
    return this.page
      .getByRole("heading", { level: 2, name })
      .locator("xpath=ancestor::*[@role='button'][1]");
  }

  /**
   * Per-card play preview button. The outer card also exposes role="button"
   * and its accessible name accumulates the inner button's label, so we
   * pass `exact: true` to disambiguate the inner button from the card.
   */
  playPreview(name: string): Locator {
    return this.page.getByRole("button", { name: `Play preview for ${name}`, exact: true });
  }

  /** Viewer-only: the "Choose another" back button is our proxy for "viewer mounted". */
  get chooseAnotherButton(): Locator {
    return this.page.getByRole("button", { name: /choose another/i });
  }
}
