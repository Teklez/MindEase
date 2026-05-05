"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getMe, clearStoredToken } from "@/lib/api";
import { useConversations } from "@/hooks/useConversations";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/shared/Logo";
import ConversationList from "@/components/chat/ConversationList";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarContentProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
  isMobile?: boolean;
  onCollapseToggle?: () => void;
};

function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SidebarContent({
  collapsed = false,
  onNavigate,
  isMobile = false,
  onCollapseToggle,
}: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentConversationId = pathname?.startsWith("/chat/")
    ? pathname.replace("/chat/", "").split("/")[0]
    : null;

  const tNav = useTranslations("nav");
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const [user, setUser] = useState<{ display_name: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { conversations, isLoading, createConversation, deleteConversation } = useConversations();

  useEffect(() => {
    getMe().then((res) => {
      if (res.ok) setUser(res.data);
    });
  }, []);

  const handleNewChat = async () => {
    onNavigate?.();
    const conv = await createConversation();
    if (conv) {
      toast({ title: tChat("conversationCreated") });
      router.push(`/chat/${conv.conversation_id}`);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      await deleteConversation(deleteConfirmId);
      toast({ title: tChat("conversationDeleted") });
      setDeleteConfirmId(null);
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    onNavigate?.();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const linkProps = onNavigate ? { onClick: onNavigate } : {};

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex h-full flex-col bg-muted/50", collapsed ? "w-[60px] items-center" : "w-full")}>
        {/* Top: Logo + New Chat + collapse toggle */}
        <div className={cn("relative shrink-0 border-b border-border p-2", collapsed && "flex flex-col items-center gap-1")}>
          {onCollapseToggle && !isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-1 h-7 w-7"
              onClick={onCollapseToggle}
              aria-label={collapsed ? tCommon("expandSidebar") : tCommon("collapseSidebar")}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  onClick={onNavigate}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-primary font-semibold hover:bg-muted"
                >
                  M
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{tCommon("appName")}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="mb-2">
              <Link href="/dashboard" {...linkProps}>
                <Logo size="md" />
              </Link>
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNewChat} aria-label={tCommon("newChat")}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{tChat("newChat")}</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
              <Plus className="h-4 w-4" />
              {tChat("newChat")}
            </Button>
          )}
        </div>

        {/* Middle: Conversations */}
        <ScrollArea className="flex-1 min-h-0">
          <div className={cn("p-2", collapsed && "px-0 flex flex-col items-center")}>
            {!collapsed && (
              <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">{tChat("conversations")}</p>
            )}
            <ConversationList
              conversations={conversations}
              activeId={currentConversationId}
              onDelete={handleDeleteRequest}
              isLoading={isLoading}
              collapsed={collapsed}
            />
          </div>
        </ScrollArea>

        {/* Bottom: Theme toggle + User menu */}
        <div className="shrink-0 border-t border-border p-2">
          <div className={cn("flex items-center gap-1 mb-2", collapsed ? "justify-center" : "justify-end")}>
            <ThemeToggle collapsed={collapsed} />
          </div>
          <Separator className="mb-2" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted",
                  collapsed && "justify-center p-2"
                )}
                aria-label={tCommon("userMenu")}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {user ? getInitials(user.display_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {user?.display_name ?? tCommon("loading")}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? "center" : "end"} side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard" {...linkProps}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {tNav("dashboard")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="mr-2 h-4 w-4" />
                {tNav("settings")}
                <span className="ml-auto text-xs text-muted-foreground">({tCommon("comingSoon").toLowerCase()})</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {tNav("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tChat("deleteConfirm")}</DialogTitle>
            <DialogDescription>{tChat("deleteConfirmDescription")}</DialogDescription>
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
    </TooltipProvider>
  );
}
