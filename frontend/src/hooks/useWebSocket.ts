"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getStoredToken } from "@/lib/api";
import { ChatWebSocket, type ChatEvent } from "@/lib/websocket";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export function useWebSocket(
  conversationId: string,
  onEvent: (event: ChatEvent) => void
): { send: (content: string, locale?: string) => void; connectionStatus: ConnectionStatus; disconnect: () => void } {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<ChatWebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const token = getStoredToken();
    if (!token || !conversationId) {
      setConnectionStatus("error");
      return;
    }

    const ws = new ChatWebSocket(conversationId, token);
    wsRef.current = ws;

    ws.connect({
      onEvent: (ev) => onEventRef.current(ev),
      onConnectionState: (state) => {
        if (state === "connecting" || state === "reconnecting") {
          setConnectionStatus("connecting");
        } else if (state === "connected") {
          setConnectionStatus("connected");
        } else if (state === "failed") {
          setConnectionStatus("error");
        }
      },
    });

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [conversationId]);

  const send = useCallback((content: string, locale?: string) => {
    wsRef.current?.send(content, locale);
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
    setConnectionStatus("disconnected");
  }, []);

  return { send, connectionStatus, disconnect };
}
