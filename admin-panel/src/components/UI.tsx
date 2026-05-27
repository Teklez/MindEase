import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// ── Confirm ───────────────────────────────────────────────────────────────────

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "destructive";
};

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastKind = "error" | "success" | "info";
type ToastOpts = { message: string; kind?: ToastKind; durationMs?: number };
type Toast = ToastOpts & { id: number; kind: ToastKind };

type UIApi = {
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  toast: (opts: ToastOpts) => void;
};

const UIContext = createContext<UIApi | null>(null);

export function useConfirm(): UIApi["confirm"] {
  const api = useContext(UIContext);
  if (!api) throw new Error("useConfirm must be used inside <UIProvider>");
  return api.confirm;
}

export function useToast(): UIApi["toast"] {
  const api = useContext(UIContext);
  if (!api) throw new Error("useToast must be used inside <UIProvider>");
  return api.toast;
}

type PendingConfirm = ConfirmOpts & { resolve: (ok: boolean) => void };

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOpts) => {
      const id = idRef.current++;
      const kind = opts.kind ?? "info";
      const duration = opts.durationMs ?? 4000;
      setToasts((prev) => [...prev, { ...opts, id, kind }]);
      window.setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  const api = useMemo<UIApi>(() => ({ confirm, toast }), [confirm, toast]);

  // Esc closes the open confirm
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pending.resolve(false);
        setPending(null);
      } else if (e.key === "Enter") {
        pending.resolve(true);
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return (
    <UIContext.Provider value={api}>
      {children}
      {pending && (
        <div
          className="ui-modal-backdrop"
          onClick={() => {
            pending.resolve(false);
            setPending(null);
          }}
        >
          <div
            className="ui-modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="ui-modal-title">{pending.title}</h4>
            {pending.message && <p className="ui-modal-message">{pending.message}</p>}
            <div className="ui-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  pending.resolve(false);
                  setPending(null);
                }}
              >
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={
                  pending.variant === "destructive"
                    ? "btn btn-destructive"
                    : "btn btn-primary"
                }
                autoFocus
                onClick={() => {
                  pending.resolve(true);
                  setPending(null);
                }}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="ui-toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`ui-toast ui-toast-${t.kind}`}>
              <span className="ui-toast-message">{t.message}</span>
              <button
                type="button"
                className="ui-toast-dismiss"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </UIContext.Provider>
  );
}
