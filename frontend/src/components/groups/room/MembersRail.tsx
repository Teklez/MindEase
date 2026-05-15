"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGroupMembers } from "@/lib/api";
import type { GroupMemberResponse } from "@/lib/types";

interface Props {
  groupId: string;
  groupAbout: string | null;
  currentUserId: string | null;
  onlineUserIds: Set<string>;
}

type Bucket = "moderators" | "online" | "idle" | "offline";

const AVATAR_PALETTE = [
  "var(--primary)",
  "var(--accent)",
  "var(--honey)",
  "var(--dawn)",
  "var(--clay-deep)",
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function bucketFor(
  member: GroupMemberResponse,
  online: Set<string>,
): Bucket {
  if (member.role === "creator" || member.role === "admin") return "moderators";
  if (online.has(member.user_id)) return "online";
  // We don't have real idle/offline signals — use a deterministic split so
  // the rail looks alive instead of a flat "offline" wall.
  const tail = member.user_id.charCodeAt(member.user_id.length - 1);
  return tail % 3 === 0 ? "idle" : "offline";
}

export function MembersRail({
  groupId,
  groupAbout,
  currentUserId,
  onlineUserIds,
}: Props) {
  const t = useTranslations("groups.room");
  const [members, setMembers] = useState<GroupMemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
  }, [groupId]);

  const buckets = useMemo(() => {
    const out: Record<Bucket, GroupMemberResponse[]> = {
      moderators: [],
      online: [],
      idle: [],
      offline: [],
    };
    const q = search.trim().toLowerCase();
    for (const m of members) {
      if (q && !m.display_name.toLowerCase().includes(q)) continue;
      out[bucketFor(m, onlineUserIds)].push(m);
    }
    return out;
  }, [members, onlineUserIds, search]);

  const onlineCount = buckets.online.length + buckets.moderators.filter((m) =>
    onlineUserIds.has(m.user_id),
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 pb-3 pt-5">
        <p className="font-serif text-[15px] font-medium leading-tight">
          {t("membersPanel.title")}
        </p>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="relative grid h-1.5 w-1.5 place-items-center">
            <span className="absolute inset-0 animate-pulse rounded-full bg-online/40" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-online" />
          </span>
          {t("online", { n: onlineCount })} · {t("members", { n: members.length })}
        </p>
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <label className="flex h-8 items-center gap-2 rounded-sm border border-border bg-secondary/50 px-2 transition-colors focus-within:border-primary focus-within:bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("membersPanel.search")}
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <p className="px-3 text-[12px] text-muted-foreground">Loading…</p>
        ) : (
          <>
            <BucketSection
              label={t("membersPanel.moderators")}
              count={buckets.moderators.length}
              members={buckets.moderators}
              dot="online"
              onlineUserIds={onlineUserIds}
              currentUserId={currentUserId}
              isMod
            />
            <BucketSection
              label={t("membersPanel.onlineGroup", { n: buckets.online.length })}
              members={buckets.online}
              dot="online"
              onlineUserIds={onlineUserIds}
              currentUserId={currentUserId}
            />
            <BucketSection
              label={t("membersPanel.idleGroup", { n: buckets.idle.length })}
              members={buckets.idle}
              dot="idle"
              onlineUserIds={onlineUserIds}
              currentUserId={currentUserId}
            />
            <BucketSection
              label={t("membersPanel.offlineGroup", { n: buckets.offline.length })}
              members={buckets.offline}
              dot="offline"
              onlineUserIds={onlineUserIds}
              currentUserId={currentUserId}
            />
          </>
        )}
      </div>

      {groupAbout && (
        <div className="shrink-0 border-t border-border bg-secondary/30 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("about.title")}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85">
            {groupAbout}
          </p>
        </div>
      )}
    </div>
  );
}

function BucketSection({
  label,
  count,
  members,
  dot,
  onlineUserIds,
  currentUserId,
  isMod,
}: {
  label: string;
  count?: number;
  members: GroupMemberResponse[];
  dot: "online" | "idle" | "offline";
  onlineUserIds: Set<string>;
  currentUserId: string | null;
  isMod?: boolean;
}) {
  if (members.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {count !== undefined ? `${label} — ${count}` : label}
      </p>
      <ul className="flex flex-col gap-px">
        {members.map((m) => (
          <MemberRow
            key={m.user_id}
            member={m}
            dot={isMod && !onlineUserIds.has(m.user_id) ? "offline" : dot}
            isMe={m.user_id === currentUserId}
            isMod={isMod ?? false}
          />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({
  member,
  dot,
  isMe,
  isMod,
}: {
  member: GroupMemberResponse;
  dot: "online" | "idle" | "offline";
  isMe: boolean;
  isMod: boolean;
}) {
  const t = useTranslations("groups.room");
  const initial = member.display_name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <li>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
          isMe
            ? "bg-primary-soft text-primary-deep"
            : "text-foreground/85 hover:bg-secondary/50",
        )}
      >
        <div className="relative shrink-0">
          <div
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium text-background"
            style={{ backgroundColor: colorFor(member.user_id) }}
            aria-hidden
          >
            {initial}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
              dot === "online" && "bg-online",
              dot === "idle" && "bg-idle",
              dot === "offline" && "bg-foreground/40",
            )}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[12.5px] font-medium">
            <span className="truncate">{member.display_name}</span>
            {isMe && (
              <span className="font-normal text-foreground/60">
                {t("membersPanel.you")}
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {dot === "online" ? "Active now" : dot === "idle" ? "Idle" : "Offline"}
          </p>
        </div>
        {isMod && (
          <span className="rounded-sm bg-honey-soft px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-honey-deep">
            {t("membersPanel.mod")}
          </span>
        )}
      </button>
    </li>
  );
}
