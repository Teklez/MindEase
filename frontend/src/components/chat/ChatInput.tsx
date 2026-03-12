"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ROWS = 1;
const MAX_HEIGHT_PX = 160;
const LINE_HEIGHT_APPROX = 24;
const RESIZE_DEBOUNCE_MS = 120;

type ChatInputProps = {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
};

export default function ChatInput({
  onSend,
  disabled,
  placeholder,
}: ChatInputProps) {
  const t = useTranslations("chat");
  const tDisclaimer = useTranslations("disclaimer");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderText = placeholder ?? t("placeholder");
  const [value, setValue] = useState("");
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adjustHeight = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, MIN_ROWS * LINE_HEIGHT_APPROX), MAX_HEIGHT_PX);
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
    setValue(e.target.value);
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

  return (
    <div className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-4xl">
        <div
          className={cn(
            "relative flex flex-col rounded-2xl border bg-background shadow-sm",
            "border-border focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
            disabled && "opacity-60"
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
            className={cn(
              "min-h-[44px] max-h-[160px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "px-4 py-3 pr-12 text-base placeholder:text-muted-foreground"
            )}
            style={{ fontSize: "16px" }}
          />
          <div className="absolute bottom-2 right-2">
            <Button
              type="button"
              size="icon"
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={disabled ? false : !hasContent}
              onClick={disabled ? undefined : send}
              aria-label={disabled ? t("stopGeneration") : t("sendMessage")}
            >
              {disabled ? (
                <Square className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {tDisclaimer("chat")}
        </p>
      </div>
    </div>
  );
}
