"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Logo from "@/components/shared/Logo";
import StarterPrompts from "@/components/chat/StarterPrompts";
import ConversationList from "@/components/chat/ConversationList";
import ChatInput from "@/components/chat/ChatInput";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INITIAL_MESSAGE_KEY = "mindease-initial-message";

export default function ChatHomePage() {
  const t = useTranslations("chat");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { conversations, isLoading, createConversation, deleteConversation } = useConversationsContext();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleStarterSelect = async (prompt: string) => {
    setCreating(true);
    const conv = await createConversation();
    setCreating(false);
    if (conv) {
      toast({ title: t("conversationCreated") });
      try {
        sessionStorage.setItem(INITIAL_MESSAGE_KEY, prompt);
      } catch {
        /* ignore */
      }
      router.push(`/chat/${conv.conversation_id}`);
    }
  };

  const handleNewChat = async () => {
    setCreating(true);
    const conv = await createConversation();
    setCreating(false);
    if (conv) {
      toast({ title: t("conversationCreated") });
      router.push(`/chat/${conv.conversation_id}`);
    }
  };

  const handleDeleteRequest = (id: string) => setDeleteConfirmId(id);
  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      await deleteConversation(deleteConfirmId);
      toast({ title: t("conversationDeleted") });
      setDeleteConfirmId(null);
    }
  };

  return (
    <>
      {/* Desktop: centered welcome + starter prompts + input */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center min-h-0">
        <div className="flex flex-col items-center text-center px-4 py-8 w-full">
          <Logo size="lg" asLink={false} className="mb-6" />
          <StarterPrompts
            showLogo={false}
            heading={t("welcomeMessage")}
            subtitle={t("welcomeSubtitle")}
            onSelect={handleStarterSelect}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {creating ? t("creatingConversation") : t("choosePrompt")}
          </p>
        </div>
        <div className="w-full">
          <ChatInput onSend={handleStarterSelect} disabled={creating} />
        </div>
      </div>

      {/* Mobile: conversation list + New Chat */}
      <div className="md:hidden flex flex-1 flex-col min-h-0">
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">{tNav("chat")}</h1>
          <Button onClick={handleNewChat} disabled={creating} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t("newChat")}
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-2">
          <ConversationList
            conversations={conversations}
            activeId={null}
            onDelete={handleDeleteRequest}
            isLoading={isLoading}
            collapsed={false}
          />
        </div>
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirm")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
