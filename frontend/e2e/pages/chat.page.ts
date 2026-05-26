import type { Locator } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Page Object for the chat surface.
 *
 * Both `/chat` (empty state) and `/chat/[conversationId]` (open thread)
 * render the same composer + message log, so a single page object covers
 * both routes. Use `goto()` for empty, `gotoConversation(id)` for a
 * thread.
 */
export class ChatPage extends BasePage {
  readonly path = "/chat";

  async gotoConversation(id: string): Promise<void> {
    await this.page.goto(`/chat/${id}`);
  }

  get composer(): Locator {
    // The composer textarea has no id; rely on its placeholder copy
    // ("Begin in your own words…" on empty `/chat`, "Message MindEase…"
    // once a thread is open).
    return this.page.getByPlaceholder(/begin in your own words|message mindease/i);
  }

  get sendButton(): Locator {
    return this.page.getByRole("button", { name: /^send( message)?$/i });
  }

  get stopButton(): Locator {
    return this.page.getByRole("button", { name: /^stop( generation)?$/i });
  }

  /** The scrollable message list — role="log" is set by MessageList. */
  get messageLog(): Locator {
    return this.page.getByRole("log", { name: /chat messages/i });
  }

  /** Sidebar conversation links — each ConversationItem renders an <a>. */
  conversationInSidebar(id: string): Locator {
    return this.page.locator(`a[href$="/chat/${id}"]`);
  }

  /**
   * The kebab/more button only renders on hover — Playwright's `visible`
   * check treats `display:hidden` as not visible, so callers should hover
   * the row before opening the menu. `openConversationMenu` does both.
   */
  conversationRow(id: string): Locator {
    return this.conversationInSidebar(id).locator("..");
  }

  async openConversationMenu(id: string): Promise<void> {
    await this.conversationRow(id).hover();
    await this.conversationRow(id).getByRole("button", { name: /^more$/i }).click();
  }

  get renameMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: /^rename conversation$/i });
  }

  get deleteMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: /^delete$/i });
  }

  get renameDialogInput(): Locator {
    return this.page.getByRole("dialog").getByPlaceholder(/anxiety before/i);
  }

  get renameDialogSave(): Locator {
    return this.page.getByRole("dialog").getByRole("button", { name: /^save$/i });
  }

  get deleteDialogConfirm(): Locator {
    return this.page.getByRole("dialog").getByRole("button", { name: /^delete$/i });
  }

  /** Assistant bubble — only renders when sender_type === "ai". */
  assistantBubble(): Locator {
    return this.messageLog.locator("div.group", { hasText: "MindEase" }).first();
  }

  helpfulButton(): Locator {
    return this.assistantBubble().getByRole("button", { name: /^helpful$/i });
  }

  notQuiteButton(): Locator {
    return this.assistantBubble().getByRole("button", { name: /^not quite$/i });
  }

  copyButton(): Locator {
    return this.assistantBubble().getByRole("button", { name: /^(copy|copied)$/i });
  }

  async sendMessage(text: string): Promise<void> {
    await this.composer.fill(text);
    await this.sendButton.click();
  }
}
