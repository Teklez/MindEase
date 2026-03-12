"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import ConversationList from "./ConversationList";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export default function ChatSidebar({ onNavigate, className }: ChatSidebarProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const currentConversationId = pathname?.startsWith("/chat/")
    ? pathname.replace("/chat/", "").split("/")[0]
    : null;

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { conversations, isLoading, createConversation, deleteConversation } = useConversationsContext();

  const handleNewChat = async () => {
    onNavigate?.();
    const conv = await createConversation();
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
      <aside
        className={cn(
          "flex w-[280px] shrink-0 flex-col border-r border-border bg-muted/80",
          className
        )}
      >
        <div className="shrink-0 border-b border-border p-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
            <Plus className="h-4 w-4" />
            {t("newChat")}
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{t("conversations")}</p>
            <ConversationList
              conversations={conversations}
              activeId={currentConversationId}
              onDelete={handleDeleteRequest}
              isLoading={isLoading}
              collapsed={false}
            />
          </div>
        </ScrollArea>
      </aside>

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
