"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ROWS = 1;
const MAX_HEIGHT_PX = 168;
const LINE_HEIGHT_APPROX = 24;
const RESIZE_DEBOUNCE_MS = 120;
const CHAR_LIMIT = 2000;

type ChatInputProps = {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
};

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const t = useTranslations("chat");
  const tDisclaimer = useTranslations("disclaimer");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderText = placeholder ?? t("placeholder");
  const [value, setValue] = useState("");
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustHeight = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const newHeight = Math.min(
      Math.max(el.scrollHeight, MIN_ROWS * LINE_HEIGHT_APPROX),
      MAX_HEIGHT_PX,
    );
    el.style.height = `${newHeight}px`;
  }, []);

  const scheduleResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(() => {
      resizeTimeoutRef.current = null;
      adjustHeight(el);
    }, RESIZE_DEBOUNCE_MS);
  }, [adjustHeight]);

  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value.slice(0, CHAR_LIMIT));
    scheduleResize();
  };

  const send = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      adjustHeight(el);
      el.focus();
    }
  }, [value, disabled, onSend, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasContent = value.trim().length > 0;
  const showCharCounter = value.length > CHAR_LIMIT * 0.8;
  const charsLeft = CHAR_LIMIT - value.length;

  return (
    <div className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-3xl">
        <div
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card shadow-soft-sm transition-all",
            "border-border focus-within:border-primary/50 focus-within:shadow-soft",
            disabled && "opacity-70",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? t("thinkingPlaceholder") : placeholderText}
            disabled={disabled}
            rows={MIN_ROWS}
            maxLength={CHAR_LIMIT}
            className={cn(
              "min-h-[48px] max-h-[168px] resize-none border-0 bg-transparent",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "px-4 py-3.5 pr-14 text-[15px] placeholder:text-muted-foreground",
            )}
            style={{ fontSize: "16px" }}
          />
          {showCharCounter && (
            <span className="absolute bottom-3 right-14 text-[11px] tabular-nums text-muted-foreground">
              {t("charsLeft", { count: charsLeft })}
            </span>
          )}
          <div className="absolute bottom-2 right-2">
            <Button
              type="button"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full bg-primary text-primary-foreground transition-all",
                hasContent || disabled ? "opacity-100" : "opacity-60",
                "hover:bg-primary/90 disabled:opacity-50",
              )}
              disabled={disabled ? false : !hasContent}
              onClick={disabled ? undefined : send}
              aria-label={disabled ? t("stopGeneration") : t("sendMessage")}
            >
              {disabled ? (
                <Square className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>
        <p className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">{t("keyboardHint")}</span>
          <span className="hidden sm:inline">·</span>
          <span>{tDisclaimer("chat")}</span>
        </p>
      </div>
    </div>
  );
}
