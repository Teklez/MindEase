export type Resource = { name: string; phone?: string; info?: string; url?: string };

export type ChatEvent = {
  type: "token" | "done" | "stopped" | "crisis_alert" | "error";
  content?: string;
  message_id?: string;
  resources?: {
    ethiopia?: Resource[];
    international?: Resource[];
  };
};

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
  if (wsUrl) return wsUrl.replace(/^http/, "ws");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (apiUrl) return apiUrl.replace(/^http/, "ws");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "failed";

export type ConnectOptions = {
  onEvent: (event: ChatEvent) => void;
  onConnectionState?: (state: ConnectionState) => void;
};

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnects = 3;
  private onEventCb: ((event: ChatEvent) => void) | null = null;
  private onStateCb: ((state: ConnectionState) => void) | null = null;
  private intentionalClose = false;

  constructor(conversationId: string, token: string) {
    const base = getWsBaseUrl();
    const sep = base.includes("?") ? "&" : "?";
    this.url = `${base}/ws/chat/${conversationId}${sep}token=${encodeURIComponent(token)}`;
    this.token = token;
  }

  connect(onEvent: (event: ChatEvent) => void): void;
  connect(options: ConnectOptions): void;
  connect(onEventOrOptions: ((event: ChatEvent) => void) | ConnectOptions): void {
    const onEvent = typeof onEventOrOptions === "function" ? onEventOrOptions : onEventOrOptions.onEvent;
    this.onStateCb = typeof onEventOrOptions === "object" ? onEventOrOptions.onConnectionState ?? null : null;
    this.onEventCb = onEvent;
    this.intentionalClose = false;
    this.onStateCb?.("connecting");
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStateCb?.("connected");
    };

    this.ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as ChatEvent;
        this.onEventCb?.(event);
      } catch {
        this.onEventCb?.({ type: "error", content: "Invalid message" });
      }
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) return;
      if (this.reconnectAttempts < this.maxReconnects) {
        this.onStateCb?.("reconnecting");
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
        this.reconnectAttempts += 1;
        setTimeout(() => this.connect({ onEvent, onConnectionState: this.onStateCb ?? undefined }), delay);
      } else {
        this.onStateCb?.("failed");
      }
    };

    this.ws.onerror = () => {
      // onclose will handle reconnect
    };
  }

  send(content: string, locale?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const payload: { type: string; content: string; locale?: string } = { type: "message", content };
      if (locale === "en" || locale === "am") payload.locale = locale;
      this.ws.send(JSON.stringify(payload));
    }
  }

  stop(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "stop" }));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onEventCb = null;
    this.onStateCb = null;
  }
}

// ---------- Group chat ----------

import type { GroupMessageResponse } from "@/lib/types";

export type GroupOnlineMember = { user_id: string; display_name: string };

export type GroupWsEvent =
  | { type: "message"; data: GroupMessageResponse }
  | { type: "crisis_alert"; resources: { ethiopia?: Resource[]; international?: Resource[] } }
  | { type: "user_joined"; user_id: string; display_name: string }
  | { type: "user_left"; user_id: string; display_name: string }
  | { type: "online_members"; members: GroupOnlineMember[] }
  | { type: "ai_thinking" }
  | { type: "ai_done" }
  | { type: "error"; content?: string };

export type GroupConnectOptions = {
  onEvent: (event: GroupWsEvent) => void;
  onConnectionState?: (state: ConnectionState) => void;
};

export class GroupChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private onEventCb: ((event: GroupWsEvent) => void) | null = null;
  private onStateCb: ((state: ConnectionState) => void) | null = null;
  private intentionalClose = false;

  constructor(groupId: string, token: string) {
    const base = getWsBaseUrl();
    const sep = base.includes("?") ? "&" : "?";
    this.url = `${base}/ws/group/${groupId}${sep}token=${encodeURIComponent(token)}`;
  }

  connect(options: GroupConnectOptions): void {
    this.onEventCb = options.onEvent;
    this.onStateCb = options.onConnectionState ?? null;
    this.intentionalClose = false;
    this.onStateCb?.("connecting");
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onStateCb?.("connected");
    };

    this.ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data as string) as GroupWsEvent;
        this.onEventCb?.(event);
      } catch {
        this.onEventCb?.({ type: "error", content: "Invalid message" });
      }
    };

    this.ws.onclose = () => {
      if (this.intentionalClose) return;
      if (this.reconnectAttempts < this.maxReconnects) {
        this.onStateCb?.("reconnecting");
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
        this.reconnectAttempts += 1;
        setTimeout(
          () =>
            this.connect({
              onEvent: this.onEventCb!,
              onConnectionState: this.onStateCb ?? undefined,
            }),
          delay,
        );
      } else {
        this.onStateCb?.("failed");
      }
    };

    this.ws.onerror = () => {
      // onclose handles reconnect
    };
  }

  sendMessage(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "message", content }));
    }
  }

  requestOnlineMembers(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "get_online" }));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onEventCb = null;
    this.onStateCb = null;
  }
}
