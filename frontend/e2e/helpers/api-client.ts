import type { APIRequestContext } from "@playwright/test";

import { API_PREFIX, API_URL } from "./env";

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: {
    user_id: string;
    email: string;
    display_name: string;
  };
}

/**
 * Thin typed wrapper around the backend HTTP API.
 *
 * Used by fixtures to seed test data (register a user, drop a record, etc.)
 * without going through the UI. Keep this surface small — only add methods
 * for things E2E tests legitimately need to set up or clean up.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  private url(path: string): string {
    return `${API_URL}${API_PREFIX}${path}`;
  }

  async register(body: RegisterPayload): Promise<TokenResponse> {
    const res = await this.request.post(this.url("/auth/register"), { data: body });
    if (!res.ok()) {
      throw new Error(`register failed (${res.status()}): ${await res.text()}`);
    }
    return (await res.json()) as TokenResponse;
  }

  async login(body: LoginPayload): Promise<TokenResponse> {
    const res = await this.request.post(this.url("/auth/login"), { data: body });
    if (!res.ok()) {
      throw new Error(`login failed (${res.status()}): ${await res.text()}`);
    }
    return (await res.json()) as TokenResponse;
  }

  async me(token: string): Promise<unknown> {
    const res = await this.request.get(this.url("/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok()) {
      throw new Error(`me failed (${res.status()}): ${await res.text()}`);
    }
    return await res.json();
  }

  async createConversation(
    token: string,
    title?: string,
  ): Promise<{ conversation_id: string; title: string | null }> {
    const res = await this.request.post(this.url("/chat/conversations"), {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: title ?? null },
    });
    if (!res.ok()) {
      throw new Error(`createConversation failed (${res.status()}): ${await res.text()}`);
    }
    return (await res.json()) as { conversation_id: string; title: string | null };
  }
}
