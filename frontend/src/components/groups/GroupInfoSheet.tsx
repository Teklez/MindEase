"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, LogOut, Trash2, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GroupResponse } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupResponse | null;
  lang: string;
  onLeave?: () => void;
  onDelete?: () => void;
}

export function GroupInfoSheet({
  open,
  onOpenChange,
  group,
  lang,
  onLeave,
  onDelete,
}: Props) {
  const t = useTranslations("groups");
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!group) return null;

  const isAm = lang === "am";
  const name = isAm && group.name_am ? group.name_am : group.name;
  const description =
    isAm && group.description_am ? group.description_am : group.description;
  const rules = isAm && group.rules_am ? group.rules_am : group.rules;
  const coverColor = group.cover_color ?? "#4A90A4";
  const isCreator = group.my_role === "creator";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-md"
      >
        <div
          className="h-2 w-full shrink-0"
          style={{ backgroundColor: coverColor }}
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-5 p-6">
          <SheetHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
                style={{ backgroundColor: `${coverColor}1A` }}
                aria-hidden
              >
                {group.icon}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-serif text-xl leading-snug">
                  {name}
                </SheetTitle>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-white"
                  style={{ backgroundColor: coverColor }}
                >
                  {group.category.replace("_", " ")}
                </span>
              </div>
            </div>
            <SheetDescription className="text-[13.5px] leading-relaxed text-foreground">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-3 text-[12.5px]">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Created by
              </p>
              <p className="mt-0.5 truncate font-medium text-foreground">
                {group.creator_name}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Members
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
                <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                {group.member_count} / {group.max_members}
              </p>
            </div>
          </div>

          {rules && (
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setRulesOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-muted/40"
                aria-expanded={rulesOpen}
              >
                <span>Group Rules</span>
                {rulesOpen ? (
                  <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
              {rulesOpen && (
                <div className="border-t border-border px-3 py-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {rules}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Created {new Date(group.created_at).toLocaleDateString()}
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            {!isCreator && group.is_member && onLeave && (
              <Button
                type="button"
                variant="outline"
                onClick={onLeave}
                className={cn(
                  "border-destructive/40 text-destructive hover:bg-destructive/10",
                )}
              >
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
                {t("leave")}
              </Button>
            )}
            {isCreator && onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Delete Group
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
