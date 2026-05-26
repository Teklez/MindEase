import type { Page } from "@playwright/test";

import { randomBytes } from "node:crypto";

/**
 * Inject a fake assistant message into a conversation by intercepting the
 * GET /api/v1/chat/conversations/{id} response.
 *
 * Real assistant messages are produced by the AI pipeline, which is too
 * slow and non-deterministic to drive from a test. Mocking this single
 * endpoint lets us cover the "what the user sees once a reply has
 * arrived" surface — copy button, feedback buttons, crisis styling —
 * without depending on Ollama or holding a WebSocket open.
 */
export async function mockConversationWithAssistantMessage(
  page: Page,
  opts: {
    conversationId: string;
    assistantContent: string;
    title?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const body = {
    conversation_id: opts.conversationId,
    user_id: "00000000-0000-0000-0000-000000000000",
    title: opts.title ?? "Mocked thread",
    started_at: now,
    last_message_at: now,
    status: "active",
    total_messages: 1,
    crisis_detected: false,
    conversation_type: "text",
    attrs: null,
    messages: [
      {
        message_id: randomBytes(16).toString("hex"),
        conversation_id: opts.conversationId,
        sender_type: "ai",
        content: opts.assistantContent,
        detected_emotion: null,
        timestamp: now,
        is_crisis_flagged: false,
      },
    ],
  };

  await page.route(`**/api/v1/chat/conversations/${opts.conversationId}`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
