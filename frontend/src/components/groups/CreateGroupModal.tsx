"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createGroup } from "@/lib/api";
import type { GroupCategory } from "@/lib/types";

const ICON_CHOICES = [
  "💬",
  "🧩",
  "🫁",
  "🌧️",
  "📚",
  "🕊️",
  "🌿",
  "🌅",
  "💪",
  "🤝",
  "❤️",
  "🛡️",
  "🧠",
  "☀️",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: GroupCategory[];
  onCreated: (groupId: string) => void;
}

export function CreateGroupModal({
  open,
  onOpenChange,
  categories,
  onCreated,
}: Props) {
  const t = useTranslations("groups.create");
  const tGroups = useTranslations("groups");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [icon, setIcon] = useState<string>("💬");
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(50);
  const [rules, setRules] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !category && categories.length > 0) {
      setCategory(categories[0].value);
      setIcon(categories[0].icon);
    }
  }, [open, categories, category]);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setCategory("");
      setIcon("💬");
      setIsPublic(true);
      setMaxMembers(50);
      setRules("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    const cat = categories.find((c) => c.value === value);
    if (cat) setIcon(cat.icon);
  };

  const validate = (): string | null => {
    if (name.trim().length < 3) return t("name") + " — at least 3 characters";
    if (name.trim().length > 100) return t("name") + " — at most 100 characters";
    if (description.trim().length < 10)
      return t("description") + " — at least 10 characters";
    if (description.trim().length > 1000)
      return t("description") + " — at most 1000 characters";
    if (!category) return t("category");
    if (maxMembers < 5 || maxMembers > 200)
      return t("maxMembers") + " — between 5 and 200";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    const res = await createGroup({
      name: name.trim(),
      description: description.trim(),
      category,
      icon,
      is_public: isPublic,
      max_members: maxMembers,
      rules: rules.trim() || null,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Failed to create group");
      return;
    }
    onCreated(res.data.group_id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("descriptionPlaceholder")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-sm font-medium text-foreground">
              {t("name")}
            </label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="group-description"
              className="text-sm font-medium text-foreground"
            >
              {t("description")}
            </label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              maxLength={1000}
              rows={3}
              required
            />
            <div className="text-right text-[11px] text-muted-foreground">
              {description.length}/1000
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="group-category" className="text-sm font-medium text-foreground">
              {t("category")}
            </label>
            <select
              id="group-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            >
              {categories.length === 0 && (
                <option value="" disabled>
                  …
                </option>
              )}
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon}  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t("icon")}</label>
            <div className="grid grid-cols-7 gap-2">
              {ICON_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md border text-xl transition-colors",
                    icon === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted",
                  )}
                  aria-label={tGroups("iconAriaLabel", { emoji })}
                  aria-pressed={icon === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("visibility")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  isPublic
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {t("public")}
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  !isPublic
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {t("private")}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="group-max" className="flex items-center justify-between text-sm font-medium text-foreground">
              <span>{t("maxMembers")}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {maxMembers}
              </span>
            </label>
            <input
              id="group-max"
              type="range"
              min={5}
              max={200}
              step={5}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="group-rules" className="text-sm font-medium text-foreground">
              {t("rules")}
            </label>
            <Textarea
              id="group-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder={t("rulesPlaceholder")}
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  {t("submit")}
                </span>
              ) : (
                t("submit")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
