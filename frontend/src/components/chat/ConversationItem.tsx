"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/relative-time";
import type { Conversation } from "@/lib/types";

type ConversationItemProps = {
  conversation: Conversation;
  isActive: boolean;
  onDelete: (id: string) => void;
  collapsed?: boolean;
};

export default function ConversationItem({
  conversation,
  isActive,
  onDelete,
  collapsed = false,
}: ConversationItemProps) {
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = conversation.title;
  const displayTitle = title ?? t("newChat");
  const isUntitled = title === null || title === "";
  const chatHref = `/chat/${conversation.conversation_id}`;
  const prefetchChat = useCallback(() => router.prefetch(chatHref), [router, chatHref]);

  if (collapsed) {
    return (
      <li className="list-none">
        <Link
          href={chatHref}
          onMouseEnter={prefetchChat}
          title={displayTitle}
          className={cn(
            "relative grid h-10 place-items-center rounded-lg transition-colors",
            isActive
              ? "bg-sidebar-accent text-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          <span className="sr-only">{displayTitle}</span>
        </Link>
      </li>
    );
  }

  return (
    <li className="list-none">
      <div
        onMouseEnter={prefetchChat}
        className={cn(
          "group relative flex items-start gap-2 rounded-lg px-3 py-2 transition-colors",
          isActive
            ? "bg-sidebar-accent"
            : "hover:bg-sidebar-accent/60",
        )}
      >
        {isActive && (
          <span
            aria-hidden
            className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-sm bg-primary"
          />
        )}

        <Link
          href={chatHref}
          className="block min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "block truncate text-[13.5px] font-medium",
                isActive ? "text-foreground" : "text-foreground",
                isUntitled && "italic text-muted-foreground font-normal",
              )}
            >
              {displayTitle}
            </span>
            {conversation.crisis_detected && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                title="Crisis support was offered"
              />
            )}
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {relativeTime(conversation.last_message_at)}
          </p>
        </Link>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                "hover:bg-background hover:text-foreground",
              )}
              aria-label="More options"
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="right"
            sideOffset={6}
            className="z-[100] w-48 shadow-soft-md"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem disabled className="cursor-not-allowed opacity-70">
              <Pencil className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {t("rename")}
              <span className="ml-1 text-xs text-muted-foreground">
                ({tCommon("comingSoon").toLowerCase()})
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onDelete(conversation.conversation_id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {tCommon("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
