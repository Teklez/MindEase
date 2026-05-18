"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mic, Paperclip, Send, Smile, Sparkles, Square } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoodCheckIn from "@/components/mood/MoodCheckIn";
import { getMoodLabel } from "@/lib/mood";

const MAX_HEIGHT_PX = 168; // ~6 rows at 28px line-height
const CHAR_SOFT_LIMIT = 800; // counter appears only past this length

export type ChatInputMention = {
  trigger: string;
  insert: string;
  label: string;
};

type ChatInputProps = {
  onSend: (content: string) => void;
  /** While streaming the send button morphs into a stop button. */
  isStreaming?: boolean;
  onStop?: () => void;
  /** Disables both the textarea and the send button (e.g. socket reconnecting). */
  disabled?: boolean;
  placeholder?: string;
  /** Optional autocomplete chip used by group rooms (@MindEase etc). */
  mention?: ChatInputMention;
};

export default function ChatInput({
  onSend,
  isStreaming = false,
  onStop,
  disabled = false,
  placeholder,
  mention,
}: ChatInputProps) {
  const t = useTranslations("chat.v2.composer");
  const locale = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [moodOpen, setMoodOpen] = useState(false);

  const placeholderText = placeholder ?? t("placeholder");

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(() => adjustHeight());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasContent = value.trim().length > 0;
  const showCounter = value.length > CHAR_SOFT_LIMIT;

  const showMentionSuggestion = useMemo(() => {
    if (!mention) return false;
    if (!value.includes(mention.trigger)) return false;
    return !value.toLowerCase().includes(mention.insert.trim().toLowerCase());
  }, [mention, value]);

  const insertMention = () => {
    if (!mention) return;
    const idx = value.lastIndexOf(mention.trigger);
    const next =
      idx === -1
        ? `${mention.insert}${value}`
        : `${value.slice(0, idx)}${mention.insert}${value.slice(idx + mention.trigger.length)}`;
    setValue(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const cursor = idx === -1 ? mention.insert.length : idx + mention.insert.length;
      el.setSelectionRange(cursor, cursor);
      adjustHeight();
    });
  };

  return (
    <div className="shrink-0 border-t border-border bg-background px-6 pb-5 pt-4">
      <div className="mx-auto w-full max-w-[760px]">
        {showMentionSuggestion && mention && (
          <div className="mb-2 flex justify-start">
            <button
              type="button"
              onClick={insertMention}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-[12px] font-medium text-primary transition-colors hover:border-primary/50"
            >
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              {mention.label}
            </button>
          </div>
        )}
        {/* Wrapper */}
        <div
          className={cn(
            "rounded-2xl border bg-card p-3 transition-all",
            "border-border focus-within:border-primary",
          )}
          style={{
            // Sage glow on focus — Tailwind can't compute the alpha modifier
            // against an oklch CSS variable, so apply via style.
            ["--ring-color" as string]:
              "color-mix(in oklab, var(--primary) 12%, transparent)",
            boxShadow: hasContent
              ? "0 0 0 4px color-mix(in oklab, var(--primary) 12%, transparent)"
              : undefined,
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            disabled={disabled}
            rows={1}
            className="block w-full resize-none bg-transparent px-1 text-[14.5px] leading-[1.55] text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              <ToolbarButton
                aria-label={t("attach")}
                onClick={() => toast({ title: t("attachComingSoon") })}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.75} />
              </ToolbarButton>
              <ToolbarButton
                aria-label={t("voice")}
                onClick={() => toast({ title: t("voiceComingSoon") })}
                disabled={disabled}
              >
                <Mic className="h-4 w-4" strokeWidth={1.75} />
              </ToolbarButton>
              <ToolbarButton
                aria-label={t("mood")}
                onClick={() => setMoodOpen(true)}
                disabled={disabled}
              >
                <Smile className="h-4 w-4" strokeWidth={1.75} />
              </ToolbarButton>
              {showCounter && (
                <span className="ml-2 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {value.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={isStreaming ? onStop : send}
              disabled={isStreaming ? false : !hasContent || disabled}
              aria-label={isStreaming ? t("stop") : t("send")}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition-all",
                "hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {isStreaming ? (
                <Square className="h-3.5 w-3.5" strokeWidth={2} fill="currentColor" />
              ) : (
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Footer hints */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>
            {locale === "am" ? (
              <span className="font-['Noto_Sans_Ethiopic',var(--font-mono)]">አማ</span>
            ) : (
              "EN"
            )}
          </span>
          <span className="hidden flex-1 px-3 text-center normal-case tracking-normal sm:inline-block">
            {t("disclaimer")}
          </span>
          <span className="hidden sm:inline">{t("hint")}</span>
        </div>
      </div>

      <Dialog open={moodOpen} onOpenChange={setMoodOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-[22px] font-[360]">{t("mood")}</DialogTitle>
          </DialogHeader>
          <MoodCheckIn
            compact
            onEntryCreated={(entry) => {
              setMoodOpen(false);
              toast({
                title: t("moodLogged", { label: getMoodLabel(entry.mood_level) }),
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
