"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import StarterPrompts from "@/components/chat/StarterPrompts";
import ChatInput from "@/components/chat/ChatInput";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";

const INITIAL_MESSAGE_KEY = "mindease-initial-message";

function LeafGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
      <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
    </svg>
  );
}

export default function ChatHomePage() {
  const t = useTranslations("chat");
  const tV2 = useTranslations("chat.v2");
  const router = useRouter();
  const { createConversation } = useConversationsContext();
  const [creating, setCreating] = useState(false);

  const handleStart = async (prompt: string) => {
    if (creating) return;
    setCreating(true);
    const conv = await createConversation();
    setCreating(false);
    if (!conv) {
      toast({ title: t("messageFailed"), variant: "destructive" });
      return;
    }
    try {
      sessionStorage.setItem(INITIAL_MESSAGE_KEY, prompt);
    } catch {
      /* ignore */
    }
    router.push(`/chat/${conv.conversation_id}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="relative grid flex-1 place-items-center overflow-hidden bg-gradient-to-b from-background to-secondary/40 p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary opacity-35 blur-3xl"
        />
        <div className="relative w-full max-w-[640px] text-center">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-primary text-primary-foreground"
            style={{
              boxShadow:
                "0 12px 24px -12px color-mix(in oklab, var(--primary) 50%, transparent)",
            }}
          >
            <LeafGlyph />
          </div>
          <h1 className="mt-5 font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.018em] text-foreground">
            {tV2("empty.headlineLead")}{" "}
            <em className="text-primary" style={{ fontStyle: "italic" }}>
              {tV2("empty.headlineEm")}
            </em>
          </h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[14.5px] leading-[1.55] text-muted-foreground">
            {tV2("empty.sub")}
          </p>
          <StarterPrompts onSelect={handleStart} />
          <div className="mt-8 flex items-center justify-center gap-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>{tV2("empty.trustEncrypted")}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>{tV2("empty.trustPrivate")}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>
              EN ·{" "}
              <span className="font-['Noto_Sans_Ethiopic',var(--font-mono)]">አማ</span>
            </span>
          </div>
        </div>
      </section>
      <ChatInput
        onSend={handleStart}
        disabled={creating}
        placeholder={tV2("composer.placeholderEmpty")}
      />
    </div>
  );
}
