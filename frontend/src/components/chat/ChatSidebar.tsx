"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, LogOut, Plus, Search } from "lucide-react";
import { useConversationsContext } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import { getMe, clearStoredToken, type ApiResponse } from "@/lib/api";
import ConversationList from "./ConversationList";
import RenameDialog from "./RenameDialog";
import type { Conversation } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function initialsOf(name: string | undefined): string {
  if (!name) return "·";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type Me = { display_name: string; email: string };

type ChatSidebarProps = {
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export default function ChatSidebar({
  onNavigate,
  className,
  collapsed = false,
  onToggleCollapsed,
}: ChatSidebarProps) {
  const t = useTranslations("chat");
  const tV2 = useTranslations("chat.v2");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const currentConversationId = pathname?.startsWith("/chat/")
    ? pathname.replace("/chat/", "").split("/")[0]
    : null;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [user, setUser] = useState<Me | null>(null);

  const { conversations, isLoading, createConversation, deleteConversation, refresh } =
    useConversationsContext();

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    getMe().then((res: ApiResponse<{ display_name: string; email: string }>) => {
      if (res.ok) setUser({ display_name: res.data.display_name, email: res.data.email });
    });
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return conversations;
    return conversations.filter((c) =>
      (c.title ?? "").toLowerCase().includes(debouncedSearch),
    );
  }, [conversations, debouncedSearch]);

  const handleNewChat = async () => {
    onNavigate?.();
    const conv = await createConversation();
    if (conv) router.push(`/chat/${conv.conversation_id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const wasActive = deleteConfirmId === currentConversationId;
    const res = await deleteConversation(deleteConfirmId);
    setDeleteConfirmId(null);
    if (!res.ok) {
      toast({ title: t("messageFailed"), variant: "destructive" });
      return;
    }
    toast({ title: t("conversationDeleted") });
    if (wasActive) router.push("/chat");
  };

  const handleLogout = () => {
    clearStoredToken();
    window.location.href = "/login";
  };

  return (
    <>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-[280px]",
          className,
        )}
      >
        {/* Collapse toggle (desktop only) */}
        {onToggleCollapsed && (
          <div
            className={cn(
              "hidden shrink-0 items-center border-b border-border px-3 py-2 lg:flex",
              collapsed ? "justify-center" : "justify-end",
            )}
          >
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? tCommon("expandSidebar") : tCommon("collapseSidebar")}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft
                className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
                strokeWidth={1.8}
              />
            </button>
          </div>
        )}

        {/* New chat */}
        <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
          <Button
            type="button"
            onClick={handleNewChat}
            aria-label={collapsed ? tV2("newChat") : undefined}
            className={cn(
              "flex h-10 w-full items-center rounded-xl bg-foreground text-background hover:bg-foreground/90",
              collapsed ? "justify-center px-0" : "justify-between px-3.5",
            )}
          >
            {collapsed ? (
              <Plus className="h-4 w-4" strokeWidth={1.8} />
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-[13.5px] font-medium">
                  <Plus className="h-4 w-4" strokeWidth={1.8} />
                  {tV2("newChat")}
                </span>
                <kbd className="hidden rounded-md border border-background/25 bg-background/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-background/80 sm:inline-block">
                  ⌘ K
                </kbd>
              </>
            )}
          </Button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tV2("search")}
                aria-label={tV2("search")}
                className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12"
              />
            </label>
          </div>
        )}

        {/* List (scrollable) */}
        {collapsed ? (
          <div className="min-h-0 flex-1" />
        ) : (
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-2">
            <ConversationList
              conversations={filtered}
              activeId={currentConversationId}
              onDelete={setDeleteConfirmId}
              onRename={setRenameTarget}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* User footer */}
        <div className={cn("shrink-0 border-t border-border py-3", collapsed ? "px-2" : "px-3")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={collapsed ? user?.display_name ?? tCommon("logout") : undefined}
                className={cn(
                  "flex w-full items-center rounded-xl text-left transition-colors hover:bg-accent",
                  collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-semibold text-secondary-foreground">
                  {initialsOf(user?.display_name)}
                </span>
                {!collapsed && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {user?.display_name ?? "—"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {user?.email ?? ""}
                    </span>
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 shadow-soft-md">
              <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                {tCommon("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <RenameDialog
        conversationId={renameTarget?.conversation_id ?? null}
        currentTitle={renameTarget?.title ?? null}
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onRenamed={() => {
          refresh?.();
        }}
      />

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
