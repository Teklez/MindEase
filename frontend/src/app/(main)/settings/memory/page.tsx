"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  deleteAllMyMemory,
  deleteMyMemoryChunk,
  getStoredToken,
  listMyMemory,
  type MemoryChunkResponse,
  type MemorySourceKind,
} from "@/lib/api";

const KIND_ORDER: MemorySourceKind[] = [
  "profile_fact",
  "summary",
  "message",
  "voice_transcript",
  "mood_note",
  "assessment_result",
  "group_message",
];

function groupByKind(
  items: MemoryChunkResponse[],
): Record<string, MemoryChunkResponse[]> {
  const out: Record<string, MemoryChunkResponse[]> = {};
  for (const it of items) {
    (out[it.source_kind] ||= []).push(it);
  }
  return out;
}

export default function MemoryPage() {
  const t = useTranslations("settings.memory");
  const router = useRouter();
  const [items, setItems] = useState<MemoryChunkResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await listMyMemory({ limit: 200 });
    setIsLoading(false);
    if (!res.ok) {
      toast({ title: t("loadFailed"), variant: "destructive" });
      return;
    }
    setItems(res.data.items);
    setTotal(res.data.total);
  }, [t]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    void refresh();
  }, [router, refresh]);

  const handleDeleteOne = useCallback(
    async (chunk: MemoryChunkResponse) => {
      setBusyId(chunk.chunk_id);
      const res = await deleteMyMemoryChunk(chunk.chunk_id);
      setBusyId(null);
      if (!res.ok) {
        toast({ title: t("deleteFailed"), variant: "destructive" });
        return;
      }
      setItems((cur) => cur.filter((c) => c.chunk_id !== chunk.chunk_id));
      setTotal((cur) => Math.max(0, cur - 1));
      toast({ title: t("deleted") });
    },
    [t],
  );

  const handleDeleteAll = useCallback(async () => {
    const res = await deleteAllMyMemory();
    if (!res.ok) {
      toast({ title: t("deleteAllFailed"), variant: "destructive" });
      return;
    }
    setItems([]);
    setTotal(0);
    setConfirmOpen(false);
    toast({ title: t("deletedAll", { count: res.data.deleted }) });
  }, [t]);

  const groups = groupByKind(items);
  const orderedKinds = KIND_ORDER.filter((k) => (groups[k] ?? []).length > 0);
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-[1.08] tracking-tight text-foreground md:text-[44px]">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        {total > 0 && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-destructive/50 bg-background px-5 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                {t("deleteAll")}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl tracking-tight">
                  {t("confirmDeleteAllTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("confirmDeleteAllBody", { count: total })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="inline-flex items-center justify-center rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  {t("confirmDeleteAll")}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <div className="mt-8 space-y-8">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-serif text-2xl tracking-tight text-foreground">
              {t("empty.title")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("empty.body")}
            </p>
          </div>
        ) : (
          orderedKinds.map((kind) => (
            <section key={kind}>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {t(`kinds.${kind}`)}{" "}
                <span className="text-muted-foreground/70">
                  ({groups[kind].length})
                </span>
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
                {groups[kind].map((chunk) => (
                  <li
                    key={chunk.chunk_id}
                    className="flex items-start gap-4 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-3 whitespace-pre-wrap text-[14px] text-foreground">
                        {chunk.text}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(chunk.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t("delete")}
                      disabled={busyId === chunk.chunk_id}
                      onClick={() => handleDeleteOne(chunk)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
