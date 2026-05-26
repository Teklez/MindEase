import { test, expect } from "../../fixtures/authenticated";
import { ChatPage } from "../../pages/chat.page";

test.describe("chat", () => {
  test("empty state renders headline + composer", async ({ authedPage }) => {
    const chat = new ChatPage(authedPage);
    await chat.goto();

    await expect(authedPage).toHaveURL(/\/chat$/);
    await expect(authedPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(chat.composer).toBeVisible();
    // Send button starts disabled — composer is empty.
    await expect(chat.sendButton).toBeDisabled();
  });

  test("typing enables Send and clicking routes into a new conversation", async ({
    authedPage,
  }) => {
    const chat = new ChatPage(authedPage);
    await chat.goto();

    const message = "Hello from the e2e suite.";
    await chat.composer.fill(message);

    // Send goes live once the textarea has content.
    await expect(chat.sendButton).toBeEnabled();
    await chat.sendButton.click();

    // The empty `/chat` page creates a conversation, stashes the prompt, and
    // routes to /chat/{id}. The user's bubble is rendered by the thread page
    // on first replay.
    await expect(authedPage).toHaveURL(/\/chat\/[0-9a-f-]{36}/);
    await expect(chat.messageLog).toBeVisible();
    await expect(chat.messageLog.getByText(message).first()).toBeVisible();
  });

  test("conversations created via API appear in the sidebar", async ({
    authedPage,
    api,
    testUser,
  }) => {
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const conv = await api.createConversation(access_token, "API-seeded thread");

    const chat = new ChatPage(authedPage);
    await chat.goto();

    await expect(chat.conversationInSidebar(conv.conversation_id)).toBeVisible();
  });
});
