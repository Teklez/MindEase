"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
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
  const prefetchChat = useCallback(() => {
    router.prefetch(chatHref);
  }, [router, chatHref]);

  const content = (
    <div
      onMouseEnter={prefetchChat}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg py-2 px-3 transition-colors",
        isActive && "bg-muted",
        !isActive && "hover:bg-muted"
      )}
    >
      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
      {collapsed ? (
        <Link
          href={chatHref}
          className="flex flex-1 items-center justify-center"
          title={displayTitle}
        >
          <span className="sr-only">{displayTitle}</span>
        </Link>
      ) : (
        <>
          <Link
            href={chatHref}
            className="min-w-0 flex-1 flex items-center gap-2"
          >
            <span className={cn("truncate text-sm", isUntitled && "italic text-muted-foreground")}>
              {displayTitle}
            </span>
          </Link>
          {conversation.crisis_detected && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-destructive"
              title="Crisis support was offered"
              aria-hidden
            />
          )}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="More options"
                aria-haspopup="menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="right"
              sideOffset={6}
              className="z-[100] w-48"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem disabled className="cursor-not-allowed opacity-70">
                <Pencil className="mr-2 h-4 w-4" />
                {t("rename")}
                <span className="ml-1 text-xs text-muted-foreground">({tCommon("comingSoon").toLowerCase()})</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  onDelete(conversation.conversation_id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Link href={chatHref} className="block">
        {content}
      </Link>
    );
  }

  return <li className="list-none">{content}</li>;
}
