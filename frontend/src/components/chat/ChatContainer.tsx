"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Phone, RotateCcw, Share2, Trash2 } from "lucide-react";
import type { CrisisResources, Message } from "@/lib/types";
import { deleteConversation as deleteConversationApi, getConversation, getMe } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConversationsRefresh } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import CrisisBanner from "./CrisisBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RenameDialog from "./RenameDialog";
import { cn, safeClipboardWrite, safeRandomUUID } from "@/lib/utils";

const INITIAL_MESSAGE_KEY = "mindease-initial-message";

type ChatContainerProps = {
  conversationId: string;
};

function initialsOf(name?: string | null): string {
  if (!name) return "·";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ChatContainer({ conversationId }: ChatContainerProps) {
  const tChat = useTranslations("chat");
  const tV2 = useTranslations("chat.v2");
  const tCommon = useTranslations("common");
  const locale = useLocale() as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const streamingContentRef = useRef<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Chat");
  const [conversationType, setConversationType] = useState<"text" | "voice">("text");
  const [personaName, setPersonaName] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const refreshConversations = useConversationsRefresh();

  const handleWebSocketEvent = useCallback(
    (event: Parameters<Parameters<typeof useWebSocket>[1]>[0]) => {
      if (event.type === "token") {
        setIsWaitingForResponse(false);
        setIsStreaming(true);
        streamingContentRef.current = (streamingContentRef.current ?? "") + (event.content ?? "");
        setStreamingContent(streamingContentRef.current);
      } else if (event.type === "done") {
        const text = streamingContentRef.current ?? "";
        streamingContentRef.current = null;
        setStreamingContent(null);
        setIsStreaming(false);
        if (text.length > 0) {
          const aiMessage: Message = {
            message_id: event.message_id ?? safeRandomUUID(),
            conversation_id: "",
            sender_type: "ai",
            content: text,
            detected_emotion: null,
            timestamp: new Date().toISOString(),
            is_crisis_flagged: false,
          };
          setMessages((m) => [...m, aiMessage]);
        }
        refreshConversations?.();
        getConversation(conversationId).then((res) => {
          if (res.ok && res.data.title) setTitle(res.data.title);
        });
      } else if (event.type === "crisis_alert") {
        const r = event.resources;
        if (!r) {
          setCrisisResources(null);
          return;
        }
        setCrisisResources({
          ethiopia: (Array.isArray(r.ethiopia) ? r.ethiopia : []).map((x) => ({
            name: x.name,
            phone: x.phone ?? "",
          })),
          international: (Array.isArray(r.international) ? r.international : []).map((x) => ({
            name: x.name,
            ...(x.info != null && { info: x.info }),
            ...(x.url != null && { url: x.url }),
          })),
        });
      } else if (event.type === "error") {
        toast({ title: tChat("messageFailed"), variant: "destructive" });
        setIsStreaming(false);
        setIsWaitingForResponse(false);
      }
    },
    [refreshConversations, conversationId, tChat],
  );

  const { send, connectionStatus } = useWebSocket(conversationId, handleWebSocketEvent);
  const sentInitialRef = useRef(false);
  const prevConnectionStatusRef = useRef<typeof connectionStatus>(connectionStatus);

  useEffect(() => {
    if (prevConnectionStatusRef.current === "connected" && connectionStatus === "error") {
      toast({ title: tChat("connectionLost"), variant: "destructive" });
    }
    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, tChat]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConversation(conversationId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setMessages(res.data.messages as Message[]);
        setTitle(res.data.title || tChat("newChat"));
        setConversationType(res.data.conversation_type ?? "text");
        setPersonaName(res.data.attrs?.persona_name ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, tChat]);

  useEffect(() => {
    getMe().then((res) => {
      if (res.ok) setUserName(res.data.display_name);
    });
  }, []);

  useEffect(() => {
    sentInitialRef.current = false;
    streamingContentRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (loading || connectionStatus !== "connected" || sentInitialRef.current) return;
    try {
      const initial = sessionStorage.getItem(INITIAL_MESSAGE_KEY);
      if (initial) {
        sessionStorage.removeItem(INITIAL_MESSAGE_KEY);
        sentInitialRef.current = true;
        const trimmed = initial.trim();
        if (trimmed) {
          const userMessage: Message = {
            message_id: safeRandomUUID(),
            conversation_id: conversationId,
            sender_type: "user",
            content: trimmed,
            detected_emotion: null,
            timestamp: new Date().toISOString(),
            is_crisis_flagged: false,
          };
          setMessages((prev) => [...prev, userMessage]);
          setStreamingContent(null);
          setIsWaitingForResponse(true);
          send(trimmed, locale === "am" || locale === "en" ? locale : undefined);
        }
      }
    } catch {
      /* ignore */
    }
  }, [loading, connectionStatus, conversationId, send, locale]);

  const handleSend = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const userMessage: Message = {
        message_id: safeRandomUUID(),
        conversation_id: conversationId,
        sender_type: "user",
        content: trimmed,
        detected_emotion: null,
        timestamp: new Date().toISOString(),
        is_crisis_flagged: false,
      };
      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent(null);
      setIsWaitingForResponse(true);
      send(trimmed, locale === "am" || locale === "en" ? locale : undefined);
    },
    [conversationId, send, locale],
  );

  const userInitials = useMemo(() => initialsOf(userName), [userName]);

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `/chat/${conversationId}`;
    // Web Share API → falls back to clipboard copy.
    const navAny = typeof navigator !== "undefined" ? navigator : undefined;
    if (navAny && typeof navAny.share === "function") {
      try {
        await navAny.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    const ok = await safeClipboardWrite(url);
    toast({
      title: ok ? tV2("thread.shareCopied") : tV2("thread.shareFailed"),
      variant: ok ? undefined : "destructive",
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteConversationApi(conversationId);
    setDeleting(false);
    if (!res.ok) {
      toast({ title: tChat("messageFailed"), variant: "destructive" });
      return;
    }
    setDeleteOpen(false);
    toast({ title: tChat("conversationDeleted") });
    refreshConversations?.();
    router.push("/chat");
  };

  const header = (
    <header className="shrink-0 border-b border-border bg-background px-6 py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[18px] font-normal tracking-[-0.005em] text-foreground">
            {title}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                connectionStatus === "connected" && "bg-primary",
                connectionStatus === "connecting" && "bg-primary animate-pulse",
                connectionStatus === "error" && "bg-destructive",
                connectionStatus === "disconnected" && "bg-muted-foreground",
              )}
            />
            {tV2("thread.connected", {
              locale: locale === "am" ? "አማ" : "EN",
            })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <HeaderIconButton aria-label={tV2("thread.rename")} onClick={() => setRenameOpen(true)}>
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </HeaderIconButton>
          <HeaderIconButton aria-label={tV2("thread.share")} onClick={handleShare}>
            <Share2 className="h-4 w-4" strokeWidth={1.75} />
          </HeaderIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <HeaderIconButton aria-label={tV2("thread.more")}>
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
              </HeaderIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-56 shadow-soft-md">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setRenameOpen(true);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                {tV2("thread.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleShare();
                }}
              >
                <Share2 className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                {tV2("thread.share")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="cursor-not-allowed opacity-70">
                {tV2("thread.regenerateTitle")}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {tCommon("comingSoon").toLowerCase()}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                {tV2("thread.deleteConversation")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {conversationType === "voice" && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-[12px] text-primary">
          <span>Voice conversation · {personaName ?? "Avatar"}</span>
          <Link
            href={`/avatar?conversation=${conversationId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] hover:underline"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
            Continue this call
          </Link>
        </div>
      )}
    </header>
  );

  const reconnectBar = (() => {
    if (connectionStatus === "connecting") {
      return (
        <div className="shrink-0 border-b border-primary/20 bg-accent px-6 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-primary">
          {tV2("thread.reconnecting")}
        </div>
      );
    }
    if (connectionStatus === "error") {
      return (
        <div className="flex shrink-0 items-center justify-center gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-[12px] text-destructive">
          <span>{tV2("thread.connectionLost")}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors hover:bg-destructive/20"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
            {tV2("thread.retry")}
          </button>
        </div>
      );
    }
    return null;
  })();

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex-1 overflow-auto bg-gradient-to-b from-background to-secondary/40">
          <div className="mx-auto w-full max-w-[760px] space-y-4 px-6 py-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={i % 2 === 0 ? "flex justify-end" : "flex gap-2.5"}>
                <Skeleton
                  className={
                    i % 2 === 0
                      ? "h-14 w-3/4 max-w-md rounded-2xl"
                      : "h-16 w-2/3 max-w-md rounded-2xl"
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-6 py-4">
          <Skeleton className="mx-auto h-14 w-full max-w-[760px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const crisisBannerNode = crisisResources ? (
    <CrisisBanner resources={crisisResources} onDismiss={() => setCrisisResources(null)} />
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {reconnectBar}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isWaitingForResponse={isWaitingForResponse}
        crisisBanner={crisisBannerNode}
        userInitials={userInitials}
      />
      {conversationType !== "voice" && (
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming || isWaitingForResponse}
          disabled={connectionStatus === "error"}
        />
      )}
      <RenameDialog
        conversationId={conversationId}
        currentTitle={title}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onRenamed={(_, newTitle) => {
          setTitle(newTitle);
          refreshConversations?.();
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tChat("deleteConfirm")}</DialogTitle>
            <DialogDescription>{tChat("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const HeaderIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
>(function HeaderIconButton({ children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
});
