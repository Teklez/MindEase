"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { updateConversation } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type RenameDialogProps = {
  conversationId: string | null;
  currentTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (id: string, title: string) => void;
};

export default function RenameDialog({
  conversationId,
  currentTitle,
  open,
  onOpenChange,
  onRenamed,
}: RenameDialogProps) {
  const t = useTranslations("chat.v2.thread");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(currentTitle?.trim() ?? "");
  }, [open, currentTitle]);

  const handleSave = async () => {
    if (!conversationId) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === (currentTitle?.trim() ?? "")) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const res = await updateConversation(conversationId, trimmed);
    setSaving(false);
    if (!res.ok) {
      toast({ title: tCommon("error"), variant: "destructive" });
      return;
    }
    onRenamed(conversationId, res.data.title ?? trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rename")}</DialogTitle>
          <DialogDescription>{t("renameDescription")}</DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder={t("renamePlaceholder")}
          maxLength={120}
          className="h-11 w-full rounded-[10px] border border-border bg-card px-3.5 text-[14.5px] text-foreground transition-colors focus:border-primary focus:outline-none"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
