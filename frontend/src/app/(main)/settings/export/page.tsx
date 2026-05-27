"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  Loader2,
  MessageCircle,
  Package,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  getAssessmentHistory,
  getChatConversations,
  getMoodHistory,
  getStoredToken,
  type ConversationResponse,
} from "@/lib/api";
import {
  exportAll,
  exportAiSummary,
  exportAssessments,
  exportChat,
  exportMood,
} from "@/lib/export";
import { isGuestUser } from "@/lib/guest";
import { cn } from "@/lib/utils";

type Counts = {
  mood: number | null;
  conversations: number | null;
  messages: number | null;
  assessments: number | null;
};

type ButtonId = string;
type ButtonState = "idle" | "loading" | "done";

export default function ExportPage() {
  const t = useTranslations("export");
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({
    mood: null,
    conversations: null,
    messages: null,
    assessments: null,
  });
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [buttonState, setButtonState] = useState<Record<ButtonId, ButtonState>>(
    {},
  );
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    setIsGuest(isGuestUser());
  }, [router]);

  useEffect(() => {
    if (isGuest) return;
    void (async () => {
      const [moodRes, chatRes, assessRes] = await Promise.all([
        getMoodHistory(36500),
        getChatConversations(),
        getAssessmentHistory(),
      ]);
      const next: Counts = { ...counts };
      if (moodRes.ok) next.mood = moodRes.data.stats?.total_entries ?? 0;
      if (chatRes.ok) {
        next.conversations = chatRes.data.length;
        next.messages = chatRes.data.reduce(
          (sum, c) => sum + (c.total_messages ?? 0),
          0,
        );
        setConversations(chatRes.data);
      }
      if (assessRes.ok) next.assessments = assessRes.data.total;
      setCounts(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  const run = async (id: ButtonId, action: () => Promise<void>) => {
    setButtonState((s) => ({ ...s, [id]: "loading" }));
    try {
      await action();
      setButtonState((s) => ({ ...s, [id]: "done" }));
      setTimeout(
        () => setButtonState((s) => ({ ...s, [id]: "idle" })),
        1500,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isMissing = /no data to export/i.test(message);
      toast({
        title: isMissing ? t("noData") : t("title"),
        description: isMissing ? undefined : message,
        variant: "destructive",
      });
      setButtonState((s) => ({ ...s, [id]: "idle" }));
    }
  };

  if (isGuest) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8">
        <h1 className="font-serif text-[28px] font-[380] tracking-[-0.018em] text-foreground">
          {t("title")}
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {t("guestBlock")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <header className="mb-8">
        <h1 className="font-serif text-[32px] font-[380] tracking-[-0.018em] text-foreground md:text-[36px]">
          {t("title")}
        </h1>
        <p className="mt-2 max-w-[58ch] text-[15px] leading-[1.55] text-muted-foreground">
          {t("subtitle")}
        </p>
        <div className="mt-4 rounded-[10px] border border-border bg-muted/60 px-4 py-3 text-[12.5px] text-muted-foreground">
          {t("privacyNotice")}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <ExportCard
          icon={<HeartPulse className="h-5 w-5" strokeWidth={1.75} />}
          title={t("moodHistory")}
          description={t("moodDesc")}
          countLabel={
            counts.mood === null
              ? "…"
              : t("moodCount", { count: counts.mood })
          }
        >
          <DownloadButton
            id="mood-csv"
            label={t("downloadCsv")}
            state={buttonState["mood-csv"] ?? "idle"}
            icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => run("mood-csv", () => exportMood("csv"))}
          />
          <DownloadButton
            id="mood-pdf"
            label={t("downloadPdf")}
            state={buttonState["mood-pdf"] ?? "idle"}
            icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => run("mood-pdf", () => exportMood("pdf"))}
          />
        </ExportCard>

        <ExportCard
          icon={<MessageCircle className="h-5 w-5" strokeWidth={1.75} />}
          title={t("chatLogs")}
          description={t("chatDesc")}
          countLabel={
            counts.conversations === null
              ? "…"
              : t("chatCount", {
                  conversations: counts.conversations,
                  messages: counts.messages ?? 0,
                })
          }
        >
          <select
            value={selectedConversation}
            onChange={(e) => setSelectedConversation(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label={t("allConversations")}
          >
            <option value="">{t("allConversations")}</option>
            {conversations.map((c) => (
              <option key={c.conversation_id} value={c.conversation_id}>
                {c.title || `Conversation ${c.conversation_id.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <DownloadButton
            id="chat-csv"
            label={t("downloadCsv")}
            state={buttonState["chat-csv"] ?? "idle"}
            icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              run("chat-csv", () =>
                exportChat("csv", selectedConversation || undefined),
              )
            }
          />
          <DownloadButton
            id="chat-pdf"
            label={t("downloadPdf")}
            state={buttonState["chat-pdf"] ?? "idle"}
            icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              run("chat-pdf", () =>
                exportChat("pdf", selectedConversation || undefined),
              )
            }
          />
        </ExportCard>

        <ExportCard
          icon={<ClipboardList className="h-5 w-5" strokeWidth={1.75} />}
          title={t("assessmentResults")}
          description={t("assessmentDesc")}
          countLabel={
            counts.assessments === null
              ? "…"
              : t("assessmentCount", { count: counts.assessments })
          }
        >
          <DownloadButton
            id="assessments-csv"
            label={t("downloadCsv")}
            state={buttonState["assessments-csv"] ?? "idle"}
            icon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              run("assessments-csv", () => exportAssessments("csv"))
            }
          />
          <DownloadButton
            id="assessments-pdf"
            label={t("downloadPdf")}
            state={buttonState["assessments-pdf"] ?? "idle"}
            icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              run("assessments-pdf", () => exportAssessments("pdf"))
            }
          />
        </ExportCard>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/12 text-primary">
              <Package className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[15px] font-medium text-foreground">
                {t("exportAll")}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {t("exportAllDesc")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DownloadButton
              id="all-pdf"
              label={t("exportAll")}
              state={buttonState["all-pdf"] ?? "idle"}
              icon={<Download className="h-4 w-4" strokeWidth={1.75} />}
              variant="primary"
              onClick={() => run("all-pdf", () => exportAll())}
            />
            <DownloadButton
              id="ai-summary"
              label="AI Summary"
              state={buttonState["ai-summary"] ?? "idle"}
              icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
              variant="ai"
              onClick={() => run("ai-summary", () => exportAiSummary())}
            />
          </div>
        </div>
      </div>

      <p className="mt-6 text-[12.5px] text-muted-foreground">
        {t("disclaimer")}
      </p>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  description,
  countLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  countLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {description}
            </p>
            <p className="mt-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
              {countLabel}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function DownloadButton({
  label,
  icon,
  state,
  variant = "secondary",
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  state: ButtonState;
  variant?: "primary" | "secondary" | "ai";
  onClick: () => void;
}) {
  const disabled = state === "loading";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
        "disabled:cursor-wait disabled:opacity-80",
        variant === "primary"
          ? "bg-foreground text-background hover:bg-foreground/85"
          : variant === "ai"
            ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            : "border border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
      ) : state === "done" ? (
        <Check className="h-4 w-4 text-primary" strokeWidth={2} />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
