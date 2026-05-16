"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, setStoredToken } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().min(1, "required").email("invalidEmail"),
  password: z.string().min(1, "required"),
  keepSignedIn: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const t = useTranslations("auth.v2.login");
  const tCommon = useTranslations("auth.v2.common");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", keepSignedIn: true },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email: values.email, password: values.password }),
      },
    );
    if (!res.ok) {
      const msg = res.error ?? t("errors.invalid");
      setSubmitError(msg);
      toast({ title: t("errors.invalid"), description: msg, variant: "destructive" });
      return;
    }
    if ("access_token" in res.data) {
      setStoredToken(res.data.access_token);
      router.replace("/dashboard");
    }
  };

  const errorMessage = (code?: string) => {
    if (!code) return null;
    return t(`errors.${code as "required" | "invalidEmail" | "invalid"}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col">
      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {t("welcomePill")}
      </span>
      <span className="mt-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("eyebrow")}
      </span>
      <h2 className="mt-3 font-serif text-[36px] font-[380] leading-[1.1] tracking-[-0.018em] text-foreground">
        {t("headlineLead")}{" "}
        <em className="font-[380] text-primary" style={{ fontStyle: "italic" }}>
          {t("headlineEm")}
        </em>
      </h2>
      <p className="mt-2 text-[15px] leading-[1.55] text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-7">
        <GoogleSignInButton variant="signin" />
      </div>

      <div className="my-[22px] flex items-center gap-3.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden />
        {tCommon("dividerOr")}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="li-email" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
            {t("emailLabel")}
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="li-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              {...register("email")}
              className={cn(
                "h-[46px] w-full rounded-[10px] border bg-background pl-11 pr-3.5 text-[14.5px] text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/15",
                errors.email ? "border-destructive focus:border-destructive" : "border-border focus:border-primary",
              )}
            />
          </div>
          {errors.email && (
            <span className="font-mono text-[11px] text-destructive">
              {errorMessage(errors.email.message)}
            </span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="li-password" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
              {t("passwordLabel")}
            </label>
            <Link href="/forgot-password" className="text-[12.5px] text-muted-foreground transition-colors hover:text-primary">
              {t("forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="li-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
              className={cn(
                "h-[46px] w-full rounded-[10px] border bg-background pl-11 pr-11 text-[14.5px] text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/15",
                errors.password ? "border-destructive focus:border-destructive" : "border-border focus:border-primary",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
            </button>
          </div>
          {errors.password && (
            <span className="font-mono text-[11px] text-destructive">
              {errorMessage(errors.password.message)}
            </span>
          )}
        </div>

        {/* Keep signed in */}
        <label className="flex cursor-pointer select-none items-start gap-2.5 text-[13px] leading-[1.5] text-foreground/80">
          <input type="checkbox" className="peer sr-only" {...register("keepSignedIn")} defaultChecked />
          <span
            aria-hidden
            className="mt-[2px] grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] border-border bg-background text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          {t("keepSignedIn")}
        </label>

        {/* Submit */}
        <div className="mt-1.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-5 text-[14.5px] font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-wait disabled:opacity-80"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                {t("submitting")}
              </>
            ) : (
              <>
                {t("submit")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </>
            )}
          </button>
        </div>

        {submitError && (
          <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive">
            {submitError}
          </div>
        )}
      </form>

      {/* Disclaimer */}
      <div className="relative mt-[22px] rounded-[10px] border border-border bg-muted/60 py-3 pl-[38px] pr-3.5 text-[12.5px] leading-[1.5] text-foreground/75">
        <span
          aria-hidden
          className="absolute left-3.5 top-4 h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_0_3px_oklch(var(--primary)/0.25)]"
        />
        {t("disclaimerLead")}{" "}
        <Link href="/privacy" className="border-b border-border text-foreground transition-colors hover:text-primary hover:border-primary">
          {t("disclaimerLink")}
        </Link>
        .
      </div>

      {/* Alt action */}
      <div className="mt-6 text-center text-[13.5px] text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="border-b border-border pb-[1px] font-medium text-foreground transition-colors hover:text-primary hover:border-primary">
          {t("createOne")}
        </Link>
      </div>
    </div>
  );
}
