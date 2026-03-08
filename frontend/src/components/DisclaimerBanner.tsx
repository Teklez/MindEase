"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "mindease-disclaimer-dismissed";

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "true") setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "true");
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 text-sm bg-amber-50 text-amber-900 border-b border-amber-200/60"
      role="banner"
    >
      <p className="flex-1 text-center sm:text-left">
        MindEase is not a substitute for professional therapy. If you&apos;re in crisis, please contact emergency services.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:bg-amber-200/60 transition-colors aria-label='Dismiss disclaimer'"
        aria-label="Dismiss disclaimer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
