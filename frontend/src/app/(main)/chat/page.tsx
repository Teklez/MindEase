"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import StarterPrompts from "@/components/chat/StarterPrompts";
import ConversationList from "@/components/chat/ConversationList";
import ChatInput from "@/components/chat/ChatInput";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  const { conversations, isLoading, createConversation, deleteConversation } =
    useConversationsContext();
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
      <div className="hidden flex-1 flex-col md:flex">
        <StarterPrompts onSelect={handleStarterSelect} />
        <ChatInput onSend={handleStarterSelect} disabled={creating} />
      </div>

      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h1 className="font-serif text-xl tracking-tight text-foreground">{tNav("chat")}</h1>
          <Button onClick={handleNewChat} disabled={creating} size="sm" className="rounded-full">
            <Plus className="mr-1 h-4 w-4" strokeWidth={1.75} />
            {t("newChat")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <ConversationList
            conversations={conversations}
            activeId={null}
            onDelete={handleDeleteRequest}
            isLoading={isLoading}
            collapsed={false}
          />
        </div>
      </div>

      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
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
