"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { loginAsGuest } from "@/lib/guest";

/**
 * Tertiary CTA on the landing page. Provisions a temporary guest session,
 * surfaces a one-time disclaimer about data not being saved, then drops the
 * user into /dashboard.
 */
export default function GuestCTAButton() {
  const t = useTranslations("guest");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await loginAsGuest();
      setShowDisclaimer(true);
    } catch (err) {
      toast({
        title: t("tryAsGuest"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAcknowledge = () => {
    setShowDisclaimer(false);
    router.replace("/dashboard");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-transparent px-3 text-[13.5px] font-medium text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-primary disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
            {t("starting")}
          </>
        ) : (
          t("tryAsGuest")
        )}
      </button>

      <Dialog
        open={showDisclaimer}
        onOpenChange={(open) => {
          if (!open) handleAcknowledge();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("disclaimerTitle")}</DialogTitle>
            <DialogDescription>{t("disclaimer")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={handleAcknowledge}
              className="inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-foreground px-4 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85 sm:w-auto"
            >
              {t("gotIt")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
