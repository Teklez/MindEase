"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { upgradeGuest } from "@/lib/guest";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    display_name: z.string().min(1, "required"),
    email: z.string().min(1, "required").email("invalidEmail"),
    password: z.string().min(8, "passwordShort"),
    confirm_password: z.string().min(1, "required"),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "mismatch",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful upgrade so the parent can refresh user state. */
  onUpgraded?: () => void;
}

export default function UpgradeModal({ open, onOpenChange, onUpgraded }: Props) {
  const t = useTranslations("guest");
  const tAuth = useTranslations("auth.v2.login.errors");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await upgradeGuest({
        email: values.email,
        password: values.password,
        display_name: values.display_name,
      });
      toast({ title: t("upgradeSuccess") });
      onUpgraded?.();
      handleClose(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  };

  const fieldError = (code?: string) => {
    if (!code) return null;
    if (code === "required") return tAuth("required");
    if (code === "invalidEmail") return tAuth("invalidEmail");
    if (code === "mismatch") return t("passwordMismatch");
    if (code === "passwordShort") return tAuth("required");
    return code;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("upgradeTitle")}</DialogTitle>
          <DialogDescription>{t("upgradeSubtitle")}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <Field
            id="ug-display-name"
            label={t("displayNameLabel")}
            error={fieldError(errors.display_name?.message)}
          >
            <input
              id="ug-display-name"
              type="text"
              autoComplete="name"
              {...register("display_name")}
              className={inputClass(!!errors.display_name)}
            />
          </Field>

          <Field
            id="ug-email"
            label={t("emailLabel")}
            error={fieldError(errors.email?.message)}
          >
            <input
              id="ug-email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={inputClass(!!errors.email)}
            />
          </Field>

          <Field
            id="ug-password"
            label={t("passwordLabel")}
            error={fieldError(errors.password?.message)}
          >
            <input
              id="ug-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className={inputClass(!!errors.password)}
            />
          </Field>

          <Field
            id="ug-confirm-password"
            label={t("confirmPasswordLabel")}
            error={fieldError(errors.confirm_password?.message)}
          >
            <input
              id="ug-confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirm_password")}
              className={inputClass(!!errors.confirm_password)}
            />
          </Field>

          {submitError && (
            <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-wait disabled:opacity-80"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "h-11 w-full rounded-[10px] border bg-background px-3.5 text-[14px] text-foreground transition-all focus:outline-none focus:ring-4 focus:ring-primary/15",
    hasError
      ? "border-destructive focus:border-destructive"
      : "border-border focus:border-primary",
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium tracking-[0.005em] text-foreground"
      >
        {label}
      </label>
      {children}
      {error && (
        <span className="font-mono text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}
