"use client";

import { useState } from "react";
import type { Resource } from "@/lib/websocket";

type CrisisBannerProps = {
  resources?: {
    ethiopia?: Resource[];
    international?: Resource[];
  };
  onDismiss?: () => void;
};

export default function CrisisBanner({ resources, onDismiss }: CrisisBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  const ethiopia = resources?.ethiopia ?? [];
  const international = resources?.international ?? [];

  return (
    <div
      className="animate-slide-down sticky top-0 z-20 rounded-b-xl mx-4 mt-2 mb-2 p-4 bg-[#DC3545] text-white shadow-lg"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0">
          <span className="shrink-0 text-white/90" aria-hidden>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold">If you&apos;re in crisis, please reach out for help</h3>
            <div className="mt-2 text-sm text-white/95 space-y-2">
              {ethiopia.length > 0 && (
                <div>
                  <p className="font-medium">Ethiopia</p>
                  <ul className="mt-1 space-y-0.5">
                    {ethiopia.map((r, i) => (
                      <li key={i}>
                        {r.phone ? (
                          <a href={`tel:${r.phone.replace(/\D/g, "")}`} className="underline hover:no-underline">
                            {r.name}: {r.phone}
                          </a>
                        ) : (
                          <span>{r.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {international.length > 0 && (
                <div>
                  <p className="font-medium">International</p>
                  <ul className="mt-1 space-y-0.5">
                    {international.map((r, i) => (
                      <li key={i}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                            {r.name}
                          </a>
                        ) : r.info ? (
                          <span>{r.name}: {r.info}</span>
                        ) : (
                          <span>{r.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
