"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import UpgradeModal from "@/components/auth/UpgradeModal";
import { isGuestUser } from "@/lib/guest";

/**
 * Thin persistent banner shown on every (main) page while the active session
 * is a guest. Reads the localStorage flag on mount so SSR output stays empty
 * and the banner appears once the client hydrates.
 *
 * The "Sign Up" button opens UpgradeModal — we deliberately keep the session
 * alive instead of routing to /register, so the conversation/mood history
 * created during guest mode is preserved.
 */
export default function GuestBanner() {
  const t = useTranslations("guest");
  const [isGuest, setIsGuest] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setIsGuest(isGuestUser());
  }, []);

  const handleUpgraded = () => {
    setIsGuest(false);
    // Refresh so server-rendered chunks (e.g. user display name) re-pull /me.
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  if (!isGuest) return null;

  return (
    <>
      <div className="sticky top-16 z-30 w-full border-b border-primary/30 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-2 md:px-8">
          <p className="text-[12.5px] font-medium leading-tight">
            {t("banner")}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary-foreground px-3 text-[12.5px] font-medium text-primary transition-opacity hover:opacity-90"
          >
            {t("signUp")}
          </button>
        </div>
      </div>

      <UpgradeModal
        open={open}
        onOpenChange={setOpen}
        onUpgraded={handleUpgraded}
      />
    </>
  );
}
