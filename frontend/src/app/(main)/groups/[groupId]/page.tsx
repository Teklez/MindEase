"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  Info,
  Loader2,
  LogOut,
  MoreVertical,
  Trash2,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import ChatInput from "@/components/chat/ChatInput";
import CrisisBanner from "@/components/chat/CrisisBanner";
import { GroupMessageBubble } from "@/components/groups/GroupMessageBubble";
import { GroupInfoSheet } from "@/components/groups/GroupInfoSheet";
import { GroupDisclaimerBanner } from "@/components/groups/GroupDisclaimerBanner";
import { EmptyGroupState } from "@/components/groups/EmptyGroupState";
import { AiThinkingIndicator } from "@/components/groups/AiThinkingIndicator";
import { MembersList } from "@/components/groups/MembersList";
import { useGroupChat } from "@/hooks/useGroupChat";
import {
  deleteGroup,
  getGroup,
  getMe,
  getStoredToken,
  joinGroup,
  leaveGroup,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { GroupMessageResponse, GroupResponse } from "@/lib/types";

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yKey = `${y.getFullYear()}-${y.getMonth()}-${y.getDate()}`;
  const k = dayKey(iso);
  if (k === todayKey) return "Today";
  if (k === yKey) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function GroupChatPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params?.groupId as string;
  const t = useTranslations("groups");
  const locale = useLocale();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getMe().then((res) => {
      if (res.ok) setCurrentUserId(res.data.user_id);
    });
  }, [router]);

  // Group fetch
  const refreshGroup = useCallback(async () => {
    setGroupLoading(true);
    const res = await getGroup(groupId);
    if (res.ok) {
      setGroup(res.data);
      setGroupError(null);
    } else {
      setGroupError(res.error ?? "Failed to load group");
    }
    setGroupLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    refreshGroup();
  }, [groupId, refreshGroup]);

  const isMember = group?.is_member ?? false;

  const {
    messages,
    isLoading: messagesLoading,
    isLoadingMore,
    hasMoreMessages,
    connectionStatus,
    onlineMembers,
    crisisResources,
    aiThinking,
    dismissCrisis,
    sendMessage,
    loadMoreMessages,
  } = useGroupChat(groupId, { enabled: isMember });

  const onlineUserIds = useMemo(
    () => new Set(onlineMembers.map((m) => m.user_id)),
    [onlineMembers],
  );

  // Find the current user's membership to detect mute state.
  const myMember = useMemo(() => {
    if (!currentUserId) return null;
    if (group?.created_by === currentUserId)
      return { role: "creator" as const, is_muted: false };
    return null;
  }, [currentUserId, group]);

  // Scroll handling — autoscroll when new messages arrive if user was at bottom;
  // preserve position when older messages are prepended.
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number | null>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  const wasAtBottomRef = useRef(true);

  // Track scroll position to know if we should autoscroll on new messages
  // and to trigger load-more when the user reaches the top.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 80;

    if (el.scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      prevScrollHeightRef.current = el.scrollHeight;
      prevFirstIdRef.current = messages[0]?.message_id ?? null;
      void loadMoreMessages();
    }
  }, [hasMoreMessages, isLoadingMore, loadMoreMessages, messages]);

  // After a load-more prepend, restore scroll so the previous oldest message
  // stays under the user's eye.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeightRef.current != null && messages.length > 0) {
      const previousFirstId = prevFirstIdRef.current;
      if (previousFirstId && messages[0].message_id !== previousFirstId) {
        const diff = el.scrollHeight - prevScrollHeightRef.current;
        el.scrollTop = diff;
      }
      prevScrollHeightRef.current = null;
      prevFirstIdRef.current = null;
      return;
    }
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, aiThinking]);

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      sendMessage(content.trim());
    },
    [sendMessage],
  );

  const handleJoin = useCallback(async () => {
    setJoining(true);
    const res = await joinGroup(groupId);
    setJoining(false);
    if (!res.ok) {
      toast({
        title: res.error ?? "Failed to join group",
        variant: "destructive",
      });
      return;
    }
    await refreshGroup();
  }, [groupId, refreshGroup]);

  const handleLeave = useCallback(async () => {
    const res = await leaveGroup(groupId);
    if (!res.ok) {
      toast({
        title: res.error ?? "Failed to leave group",
        variant: "destructive",
      });
      return;
    }
    router.push("/groups");
  }, [groupId, router]);

  const handleDelete = useCallback(async () => {
    const res = await deleteGroup(groupId);
    if (!res.ok) {
      toast({
        title: res.error ?? "Failed to delete group",
        variant: "destructive",
      });
      return;
    }
    router.push("/groups");
  }, [groupId, router]);

  if (!groupId) return null;

  // ---- error / not-found state ----
  if (!groupLoading && (groupError || !group)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-serif text-xl text-foreground">
          {groupError ?? "Group not found"}
        </p>
        <Link
          href="/groups"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Back to groups
        </Link>
      </div>
    );
  }

  if (groupLoading || !group) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  const isAm = locale === "am";
  const groupName = isAm && group.name_am ? group.name_am : group.name;
  const groupDescription =
    isAm && group.description_am ? group.description_am : group.description;
  const coverColor = group.cover_color ?? "#4A90A4";
  const isCreator = group.my_role === "creator";
  const isAdminOrCreator = isCreator || group.my_role === "admin";
  const isMutedForMe = myMember?.is_muted ?? false;

  // ---- join overlay (not yet a member) ----
  if (!group.is_member) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <Link
          href="/groups"
          className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to groups
        </Link>

        <div
          className="flex h-20 w-20 items-center justify-center rounded-3xl text-5xl"
          style={{ backgroundColor: `${coverColor}1A` }}
          aria-hidden
        >
          {group.icon}
        </div>
        <div>
          <h1 className="font-serif text-3xl text-foreground">{groupName}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            {groupDescription}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" strokeWidth={1.75} />
            {t("members", { count: group.member_count })}
          </p>
        </div>

        {(group.rules || group.rules_am) && (
          <div className="w-full rounded-xl border border-border bg-muted/30 p-5 text-left">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Group Rules
            </p>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">
              {isAm && group.rules_am ? group.rules_am : group.rules}
            </p>
          </div>
        )}

        <Button
          type="button"
          size="lg"
          onClick={handleJoin}
          disabled={joining || !group.is_public}
        >
          {joining ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            t("join")
          )}
        </Button>
      </div>
    );
  }

  // ---- member view ----
  const grouped: { dayLabel: string; items: GroupMessageResponse[] }[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const k = dayKey(m.timestamp);
    if (k !== lastDay) {
      grouped.push({ dayLabel: dayLabel(m.timestamp), items: [] });
      lastDay = k;
    }
    grouped[grouped.length - 1].items.push(m);
  }
  // System messages (joins/leaves) don't make a group feel "alive" — keep
  // showing the empty-state nudge until a real conversation starts.
  const hasNonSystemMessages = messages.some(
    (m) => m.sender_type !== "system",
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
        <Link
          href="/groups"
          aria-label="Back to groups"
          className="-ml-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-9 md:w-9"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl"
          style={{ backgroundColor: `${coverColor}1A` }}
          aria-hidden
        >
          {group.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[16px] leading-tight text-foreground">
            {groupName}
          </h1>
          <p className="mt-0.5 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Users className="h-3 w-3" strokeWidth={1.75} />
              {t("members", { count: group.member_count })}
            </button>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connectionStatus === "connected"
                    ? "bg-success"
                    : "bg-muted-foreground",
                )}
              />
              {onlineMembers.length} online
            </span>
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setInfoOpen(true)}
          aria-label="Group info"
          className="hidden md:inline-flex"
        >
          <Info className="h-4 w-4" strokeWidth={1.75} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-9 md:w-9"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setInfoOpen(true)}>
              <Info className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Group Info
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMembersOpen(true)}>
              <Users className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Members
            </DropdownMenuItem>
            {!isCreator && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLeave}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
                  {t("leave")}
                </DropdownMenuItem>
              </>
            )}
            {isAdminOrCreator && (
              <DropdownMenuItem disabled>Group Settings</DropdownMenuItem>
            )}
            {isCreator && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                  Delete Group
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Connection state strip */}
      {connectionStatus === "connecting" && (
        <p className="shrink-0 bg-muted py-1.5 text-center text-xs text-muted-foreground">
          Connecting…
        </p>
      )}
      {connectionStatus === "error" && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 py-2 px-4 text-center text-sm text-destructive">
          Connection problem. Refresh the page to reconnect.
        </div>
      )}

      {/* Pinned peer-support disclaimer (dismissible per session) */}
      <GroupDisclaimerBanner />

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
          {hasMoreMessages && (
            <div className="mb-4 flex justify-center">
              {isLoadingMore ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  strokeWidth={1.75}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => void loadMoreMessages()}
                  className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Load older messages
                </button>
              )}
            </div>
          )}

          {crisisResources && (
            <CrisisBanner
              resources={crisisResources}
              onDismiss={dismissCrisis}
            />
          )}

          {messagesLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
            </div>
          ) : !hasNonSystemMessages ? (
            <EmptyGroupState onPick={handleSend} />
          ) : (
            <div className="space-y-5">
              {grouped.map((g, gi) => (
                <div key={`${gi}-${g.dayLabel}`} className="space-y-3">
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-muted px-3 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                      {g.dayLabel}
                    </span>
                  </div>
                  {g.items.map((m) => (
                    <GroupMessageBubble
                      key={m.message_id}
                      message={m}
                      isCurrentUser={
                        currentUserId != null && m.user_id === currentUserId
                      }
                      lang={locale}
                    />
                  ))}
                </div>
              ))}
              {aiThinking && <AiThinkingIndicator />}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isMutedForMe || connectionStatus !== "connected"}
        placeholder={
          isMutedForMe
            ? "You have been muted by an admin"
            : `Message ${groupName}...`
        }
        mention={{
          trigger: "@",
          insert: "@MindEase ",
          label: "@MindEase",
        }}
      />

      {/* Sheets */}
      <GroupInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        group={group}
        lang={locale}
        onLeave={!isCreator ? handleLeave : undefined}
        onDelete={isCreator ? () => setConfirmDelete(true) : undefined}
      />
      <MembersList
        open={membersOpen}
        onOpenChange={setMembersOpen}
        groupId={groupId}
        myRole={group.my_role}
        onlineUserIds={onlineUserIds}
      />

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg text-foreground">Delete this group?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This is a soft delete — the group will be hidden from members.
              Existing messages and members are kept.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
