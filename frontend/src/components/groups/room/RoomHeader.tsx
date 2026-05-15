"use client";

import { ChevronLeft, Info, Menu, MoreVertical, Pin, Users } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  roomName: string;
  topic: string;
  isCreator: boolean;
  isAdminOrCreator: boolean;
  onOpenInfo: () => void;
  onOpenMembers: () => void;
  onOpenChannels: () => void; // mobile only
  onLeave?: () => void;
  onDelete?: () => void;
  leaveLabel: string;
}

export function RoomHeader({
  roomName,
  topic,
  isCreator,
  isAdminOrCreator,
  onOpenInfo,
  onOpenMembers,
  onOpenChannels,
  onLeave,
  onDelete,
  leaveLabel,
}: Props) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 py-3 md:px-7 md:py-3.5">
      <div className="flex min-w-0 items-center gap-2 md:gap-3.5">
        {/* Mobile-only: back to groups */}
        <Link
          href="/groups"
          aria-label="Back to groups"
          className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>

        {/* Mobile-only: hamburger to open channels rail */}
        <button
          type="button"
          onClick={onOpenChannels}
          aria-label="Open channels"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <span className="font-mono text-lg text-foreground/40">#</span>
        <h2 className="truncate font-serif text-[17px] font-medium tracking-tight">
          {roomName}
        </h2>
        <span className="hidden truncate border-l border-border pl-3.5 text-[13px] text-muted-foreground md:inline-block md:max-w-[42ch]">
          {topic}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <IconButton title="Pinned posts" disabled>
          <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
        <IconButton title="Members" onClick={onOpenMembers} className="xl:hidden">
          <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
        <IconButton title="Group info" onClick={onOpenInfo}>
          <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="grid h-[34px] w-[34px] place-items-center rounded-full border border-border bg-secondary/50 text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onOpenInfo}>About this circle</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenMembers}>Members</DropdownMenuItem>
            {isAdminOrCreator && <DropdownMenuItem disabled>Settings</DropdownMenuItem>}
            {!isCreator && onLeave && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLeave}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  {leaveLabel}
                </DropdownMenuItem>
              </>
            )}
            {isCreator && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  Delete group
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-[34px] w-[34px] place-items-center rounded-full border border-border bg-secondary/50 text-foreground/70 transition-colors",
        "hover:bg-background hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
