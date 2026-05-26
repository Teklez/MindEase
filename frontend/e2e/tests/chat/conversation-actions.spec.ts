import { test, expect } from "../../fixtures/authenticated";
import { ChatPage } from "../../pages/chat.page";

test.describe("chat · conversation actions", () => {
  test("rename a conversation updates its sidebar label", async ({
    authedPage,
    api,
    testUser,
  }) => {
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const conv = await api.createConversation(access_token, "Original title");

    const chat = new ChatPage(authedPage);
    await chat.goto();
    await expect(chat.conversationInSidebar(conv.conversation_id)).toContainText(
      "Original title",
    );

    await chat.openConversationMenu(conv.conversation_id);
    await chat.renameMenuItem.click();

    const renamed = "Renamed by e2e";
    await chat.renameDialogInput.fill(renamed);
    await chat.renameDialogSave.click();

    await expect(chat.conversationInSidebar(conv.conversation_id)).toContainText(
      renamed,
    );
  });

  test("delete a conversation removes its sidebar row", async ({
    authedPage,
    api,
    testUser,
  }) => {
    const { access_token } = await api.login({
      email: testUser.email,
      password: testUser.password,
    });
    const conv = await api.createConversation(access_token, "Doomed thread");

    const chat = new ChatPage(authedPage);
    await chat.goto();
    await expect(chat.conversationInSidebar(conv.conversation_id)).toBeVisible();

    await chat.openConversationMenu(conv.conversation_id);
    await chat.deleteMenuItem.click();
    await chat.deleteDialogConfirm.click();

    await expect(chat.conversationInSidebar(conv.conversation_id)).toHaveCount(0);
  });
});
