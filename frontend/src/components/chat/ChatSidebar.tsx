"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Lock, Plus, Search } from "lucide-react";
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

const COLLAPSED_KEY = "mindease-chat-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const { conversations, isLoading, createConversation, deleteConversation } =
    useConversationsContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const handleNewChat = async () => {
    onNavigate?.();
    const conv = await createConversation();
    if (conv) {
      toast({ title: t("conversationCreated") });
      router.push(`/chat/${conv.conversation_id}`);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? "").toLowerCase().includes(q));
  }, [conversations, search]);

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
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all",
          collapsed ? "w-[72px]" : "w-[300px]",
          className,
        )}
      >
        <div className="shrink-0 px-3 pt-4">
          <Button
            type="button"
            onClick={handleNewChat}
            className={cn(
              "w-full justify-center rounded-xl bg-foreground text-background hover:bg-foreground/90",
              collapsed ? "h-10 px-0" : "h-10 gap-2",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="text-sm font-medium">{t("newConversation")}</span>}
          </Button>
        </div>

        {!collapsed && (
          <div className="shrink-0 px-3 pt-3">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchConversations")}
                className="h-9 w-full rounded-lg border border-sidebar-border bg-background pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label={t("searchConversations")}
              />
            </label>
          </div>
        )}

        <ScrollArea className="mt-2 min-h-0 flex-1">
          <div className="px-2 pb-2">
            <ConversationList
              conversations={filtered}
              activeId={currentConversationId}
              onDelete={handleDeleteRequest}
              isLoading={isLoading}
              collapsed={collapsed}
            />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3 text-primary" strokeWidth={1.75} />
                {t("encryptedFooter")}
              </span>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                aria-label={tCommon("collapseSidebar")}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="mx-auto block rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              aria-label={tCommon("expandSidebar")}
            >
              <ChevronLeft className="h-4 w-4 rotate-180" strokeWidth={1.75} />
            </button>
          )}
        </div>
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
