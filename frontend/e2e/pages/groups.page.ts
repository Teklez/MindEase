import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for the `/groups` surface.
 *
 * The route mounts a persistent left sidebar (search + tabs + group list +
 * Create) and a content slot. Picking a group navigates to `/groups/{id}`
 * within the same shell.
 */
export class GroupsPage extends BasePage {
  readonly path = "/groups";

  // ── Sidebar ─────────────────────────────────────────────────────────
  get sidebarTitle(): Locator {
    return this.page.getByRole("link", { name: /support groups/i });
  }

  get myGroupsTab(): Locator {
    return this.page.getByRole("button", { name: /^my groups$/i });
  }

  get discoverTab(): Locator {
    return this.page.getByRole("button", { name: /^discover$/i });
  }

  /** Icon button next to the title (aria-label "Create Group"). */
  get createIconButton(): Locator {
    return this.page.getByRole("button", { name: /^create group$/i }).first();
  }

  /** Outlined CTA inside the empty-state list. */
  get createInlineButton(): Locator {
    return this.page.getByRole("button", { name: /^create group$/i }).last();
  }

  /** Empty-state copy in My-Groups tab when the user has joined nothing yet. */
  get emptyMyGroupsCopy(): Locator {
    return this.page.getByText(/you haven't joined any groups yet/i);
  }

  // ── Create modal ────────────────────────────────────────────────────
  get createDialog(): Locator {
    return this.page.getByRole("dialog", { name: /create a support group/i });
  }

  get nameInput(): Locator {
    return this.createDialog.locator("#group-name");
  }

  get descriptionInput(): Locator {
    return this.createDialog.locator("#group-description");
  }

  get categorySelect(): Locator {
    return this.createDialog.locator("#group-category");
  }

  get submitCreate(): Locator {
    return this.createDialog.getByRole("button", { name: /^create group$/i });
  }
}
