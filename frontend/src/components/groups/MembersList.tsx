"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Crown, Loader2, MoreVertical, Search, Shield } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getGroupMembers,
  muteGroupMember,
  promoteGroupMember,
  removeGroupMember,
} from "@/lib/api";
import type { GroupMemberResponse } from "@/lib/types";

const AVATAR_PALETTE = [
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#6366F1",
  "#0EA5E9",
  "#EF4444",
  "#14B8A6",
  "#A855F7",
  "#F97316",
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initialOf(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  myRole: "creator" | "admin" | "member" | null;
  onlineUserIds: Set<string>;
}

export function MembersList({
  open,
  onOpenChange,
  groupId,
  myRole,
  onlineUserIds,
}: Props) {
  const t = useTranslations("groups");
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getGroupMembers(groupId).then((res) => {
      if (cancelled) return;
      if (res.ok) setMembers(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, groupId]);

  const canManage = myRole === "creator" || myRole === "admin";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.display_name.toLowerCase().includes(q));
  }, [members, search]);

  const refresh = async () => {
    const res = await getGroupMembers(groupId);
    if (res.ok) setMembers(res.data);
  };

  const handlePromote = async (userId: string) => {
    setActingOn(userId);
    await promoteGroupMember(groupId, userId);
    await refresh();
    setActingOn(null);
  };

  const handleMute = async (userId: string, mute: boolean) => {
    setActingOn(userId);
    await muteGroupMember(groupId, userId, mute);
    await refresh();
    setActingOn(null);
  };

  const handleRemove = async (userId: string) => {
    setActingOn(userId);
    await removeGroupMember(groupId, userId);
    await refresh();
    setActingOn(null);
  };

  const roleBadge = (role: GroupMemberResponse["role"]) => {
    if (role === "creator") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
          <Crown className="h-3 w-3" strokeWidth={2} />
          {t("creator")}
        </span>
      );
    }
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <Shield className="h-3 w-3" strokeWidth={2} />
          {t("admin")}
        </span>
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="font-serif text-lg">
            Members ({members.length})
          </SheetTitle>
        </SheetHeader>

        <div className="border-b border-border px-6 py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No members found
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((member) => {
                const isOnline = onlineUserIds.has(member.user_id);
                const color = colorFor(member.user_id);
                return (
                  <li
                    key={member.user_id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/40"
                  >
                    <div className="relative shrink-0">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {initialOf(member.display_name)}
                      </div>
                      {isOnline && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success"
                          aria-label="online"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-medium text-foreground">
                          {member.display_name}
                        </span>
                        {member.is_muted && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[9.5px] uppercase tracking-wide text-muted-foreground">
                            muted
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {roleBadge(member.role) ?? (
                          <span>{t("member")}</span>
                        )}
                      </div>
                    </div>
                    {canManage && member.role !== "creator" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:h-9 md:w-9",
                              actingOn === member.user_id && "opacity-50",
                            )}
                            disabled={actingOn === member.user_id}
                            aria-label="Member actions"
                          >
                            <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {myRole === "creator" && member.role === "member" && (
                            <DropdownMenuItem
                              onClick={() => handlePromote(member.user_id)}
                            >
                              Promote to Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              handleMute(member.user_id, !member.is_muted)
                            }
                          >
                            {member.is_muted ? "Unmute" : "Mute"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemove(member.user_id)}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
