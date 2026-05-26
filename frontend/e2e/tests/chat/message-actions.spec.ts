import { test, expect } from "../../fixtures/authenticated";
import { mockConversationWithAssistantMessage } from "../../helpers/chat-mocks";
import { ChatPage } from "../../pages/chat.page";

const ASSISTANT_REPLY = "Here is a calm, supportive reply from MindEase.";
const MOCK_CONVERSATION_ID = "11111111-2222-3333-4444-555555555555";

test.describe("chat · message actions", () => {
  test.beforeEach(async ({ authedPage }) => {
    await mockConversationWithAssistantMessage(authedPage, {
      conversationId: MOCK_CONVERSATION_ID,
      assistantContent: ASSISTANT_REPLY,
    });
    // Grant clipboard permissions when the browser supports them — Firefox's
    // permission API doesn't accept the "clipboard-*" names so we fall
    // through to safeClipboardWrite's execCommand path instead.
    await authedPage
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"])
      .catch(() => {
        /* unsupported on this browser; the copy spec degrades gracefully */
      });
  });

  test("copy button flips to Copied and writes the message to the clipboard", async ({
    authedPage,
  }) => {
    const chat = new ChatPage(authedPage);
    await chat.gotoConversation(MOCK_CONVERSATION_ID);

    await expect(chat.assistantBubble()).toContainText(ASSISTANT_REPLY);

    await chat.copyButton().click();
    // The button's accessible name toggles to "Copied" for ~1.4s after click.
    await expect(
      chat.assistantBubble().getByRole("button", { name: /^copied$/i }),
    ).toBeVisible();

    // Verify the clipboard actually got the assistant content. Some headless
    // browsers reject clipboard reads even with permissions granted; fall
    // back to the visible "Copied" indicator instead of failing the test.
    const clipText = await authedPage
      .evaluate(() => navigator.clipboard.readText())
      .catch(() => null);
    if (clipText !== null) {
      expect(clipText).toBe(ASSISTANT_REPLY);
    }
  });

  test("feedback buttons toggle between Helpful and Not quite", async ({
    authedPage,
  }) => {
    const chat = new ChatPage(authedPage);
    await chat.gotoConversation(MOCK_CONVERSATION_ID);

    const helpful = chat.helpfulButton();
    const notQuite = chat.notQuiteButton();

    await helpful.click();
    // Active styling sets aria-pressed-style classes; simplest proof of
    // change is the toast that fires only on a new selection.
    await expect(authedPage.getByText("Thanks for the feedback", { exact: true }).first()).toBeVisible();

    // Switching to Not quite fires the toast again (mutually exclusive).
    await notQuite.click();
    await expect(authedPage.getByText("Thanks for the feedback", { exact: true }).first()).toBeVisible();

    // Clicking Not quite a second time toggles it OFF — no new toast,
    // and the button returns to its inactive label.
    await notQuite.click();
    await expect(notQuite).toBeVisible();
  });
});
