"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import { exportChat } from "@/lib/export";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ConversationItemProps = {
  conversation: Conversation;
  isActive: boolean;
  onDelete: (id: string) => void;
  onRename?: (conv: Conversation) => void;
};

export default function ConversationItem({
  conversation,
  isActive,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const t = useTranslations("chat");
  const tV2 = useTranslations("chat.v2");
  const tCommon = useTranslations("common");
  const tExport = useTranslations("export");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const title = conversation.title?.trim();
  const isUntitled = !title;
  const displayTitle = title || t("newChat");
  const href = `/chat/${conversation.conversation_id}`;
  const prefetch = () => router.prefetch(href);

  const messages = conversation.total_messages;
  const subline =
    messages > 0
      ? `${messages} message${messages === 1 ? "" : "s"}`
      : t("startFirst");

  return (
    <li className="list-none">
      <div
        onMouseEnter={prefetch}
        className={cn(
          "group relative rounded-xl transition-all",
          isActive
            ? "border border-primary bg-card"
            : "border border-transparent hover:bg-accent",
        )}
        style={
          isActive
            ? {
                boxShadow:
                  "0 0 0 3px color-mix(in oklab, var(--primary) 10%, transparent)",
              }
            : undefined
        }
      >
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          className="block rounded-xl px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "line-clamp-2 text-[13.5px] font-medium leading-snug",
                  isUntitled ? "italic text-muted-foreground" : "text-foreground",
                )}
              >
                {displayTitle}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {subline}
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {relativeTime(conversation.last_message_at)}
            </span>
          </div>
        </Link>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className={cn(
                "absolute right-1.5 top-1.5 hidden h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground group-hover:grid",
                menuOpen && "grid bg-muted text-foreground",
              )}
              aria-label={tV2("thread.more")}
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" sideOffset={6} className="w-48 shadow-soft-md">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onRename?.(conversation);
              }}
              disabled={!onRename}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              {tV2("thread.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault();
                setMenuOpen(false);
                try {
                  await exportChat("pdf", conversation.conversation_id);
                } catch (err) {
                  toast({
                    title: tExport("title"),
                    description: err instanceof Error ? err.message : String(err),
                    variant: "destructive",
                  });
                }
              }}
            >
              <Download className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              {tExport("exportConversation")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onDelete(conversation.conversation_id);
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              {tCommon("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
