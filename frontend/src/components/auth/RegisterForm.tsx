"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, setStoredToken } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { cn } from "@/lib/utils";

const PASSWORD_TESTS = {
  length: (p: string) => p.length >= 8,
  upper: (p: string) => /[A-Z]/.test(p),
  lower: (p: string) => /[a-z]/.test(p),
  number: (p: string) => /[0-9]/.test(p),
} as const;

const schema = z
  .object({
    displayName: z.string().min(1, "nameTooShort"),
    email: z.string().min(1, "required").email("invalidEmail"),
    password: z
      .string()
      .min(8, "passwordWeak")
      .regex(/[A-Z]/, "passwordWeak")
      .regex(/[a-z]/, "passwordWeak")
      .regex(/[0-9]/, "passwordWeak"),
    confirmPassword: z.string(),
    agreeTerms: z.boolean(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  })
  .refine((d) => d.agreeTerms === true, {
    path: ["agreeTerms"],
    message: "termsRequired",
  });

type FormValues = z.infer<typeof schema>;

function passwordScore(p: string): 0 | 1 | 2 | 3 | 4 {
  const checks = [
    PASSWORD_TESTS.length(p),
    PASSWORD_TESTS.upper(p),
    PASSWORD_TESTS.lower(p),
    PASSWORD_TESTS.number(p),
  ];
  return checks.filter(Boolean).length as 0 | 1 | 2 | 3 | 4;
}

export default function RegisterForm() {
  const t = useTranslations("auth.v2.register");
  const tCommon = useTranslations("auth.v2.common");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeTerms: false,
    },
  });

  const password = watch("password") ?? "";
  const confirm = watch("confirmPassword") ?? "";
  const score = passwordScore(password);

  const reqs = [
    { key: "length" as const, met: PASSWORD_TESTS.length(password) },
    { key: "upper" as const, met: PASSWORD_TESTS.upper(password) },
    { key: "lower" as const, met: PASSWORD_TESTS.lower(password) },
    { key: "number" as const, met: PASSWORD_TESTS.number(password) },
  ];

  const strengthLabelKey = (() => {
    if (score === 0) return null;
    if (score === 1) return "weak";
    if (score === 2) return "okay";
    if (score === 3) return "good";
    return "strong";
  })();

  const passwordsMatch = confirm.length > 0 && confirm === password;

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const res = await apiRequest<{ access_token: string; token_type: string; user: unknown }>(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          display_name: values.displayName,
        }),
      },
    );
    if (!res.ok) {
      const msg = res.error ?? t("errors.passwordWeak");
      setSubmitError(msg);
      toast({ title: t("errors.emailExists"), description: msg, variant: "destructive" });
      return;
    }
    if ("access_token" in res.data) {
      setStoredToken(res.data.access_token);
      router.replace("/dashboard");
    }
  };

  const errorMessage = (code?: string) => {
    if (!code) return null;
    const key = `errors.${code}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (t as unknown as (k: string) => string)(key);
  };

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
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
        <GoogleSignInButton variant="signup" />
      </div>

      <div className="my-[22px] flex items-center gap-3.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden />
        {tCommon("dividerOr")}
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]">
        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rg-name" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
            {t("displayNameLabel")}
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="rg-name"
              type="text"
              placeholder={t("displayNamePlaceholder")}
              autoComplete="name"
              {...register("displayName")}
              className={cn(
                "h-[46px] w-full rounded-[10px] border bg-background pl-11 pr-3.5 text-[14.5px] text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/15",
                errors.displayName ? "border-destructive focus:border-destructive" : "border-border focus:border-primary",
              )}
            />
          </div>
          {errors.displayName && (
            <span className="font-mono text-[11px] text-destructive">{errorMessage(errors.displayName.message)}</span>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rg-email" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
            {t("emailLabel")}
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="rg-email"
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
            <span className="font-mono text-[11px] text-destructive">{errorMessage(errors.email.message)}</span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="rg-password" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
              {t("passwordLabel")}
            </label>
            <span className="text-[12px] text-muted-foreground">{t("passwordHint")}</span>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="rg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("password")}
              className={cn(
                "h-[46px] w-full rounded-[10px] border bg-background pl-11 pr-11 text-[14.5px] text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/15",
                errors.password
                  ? "border-destructive focus:border-destructive"
                  : score === 4
                    ? "border-primary"
                    : "border-border focus:border-primary",
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

          {/* Strength bar */}
          <div className="mt-1 flex items-center gap-2.5">
            <div className="flex h-1 flex-1 gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-colors",
                    i < score ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
            {strengthLabelKey && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary">
                {t(`strength.${strengthLabelKey}`)}
              </span>
            )}
          </div>

          {/* Requirements grid */}
          <div className="mt-1 grid grid-cols-2 gap-x-3.5 gap-y-1.5">
            {reqs.map((r) => (
              <span
                key={r.key}
                className={cn(
                  "flex items-center gap-2 text-[12px] transition-colors",
                  r.met ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-3.5 w-3.5 place-items-center rounded-full border transition-colors",
                    r.met
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-transparent text-transparent",
                  )}
                >
                  <Check className="h-2 w-2" strokeWidth={3} />
                </span>
                {t(`requirements.${r.key}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Confirm */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rg-confirm" className="text-[13px] font-medium tracking-[0.005em] text-foreground">
            {t("confirmPasswordLabel")}
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              id="rg-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              {...register("confirmPassword")}
              className={cn(
                "h-[46px] w-full rounded-[10px] border bg-background pl-11 pr-11 text-[14.5px] text-foreground transition-all placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/15",
                errors.confirmPassword
                  ? "border-destructive focus:border-destructive"
                  : passwordsMatch
                    ? "border-primary"
                    : "border-border focus:border-primary",
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
            </button>
          </div>
          {passwordsMatch && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-primary animate-fade-in">
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t("passwordsMatch")}
            </span>
          )}
          {errors.confirmPassword && !passwordsMatch && (
            <span className="font-mono text-[11px] text-destructive">
              {errorMessage(errors.confirmPassword.message)}
            </span>
          )}
        </div>

        {/* Terms */}
        <label className="flex cursor-pointer select-none items-start gap-2.5 text-[13px] leading-[1.5] text-foreground/80">
          <input type="checkbox" className="peer sr-only" {...register("agreeTerms")} />
          <span
            aria-hidden
            className="mt-[2px] grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] border-border bg-background text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span>
            {t("agreePrefix")}{" "}
            <Link href="/terms" className="border-b border-border text-foreground transition-colors hover:text-primary hover:border-primary">
              {t("agreeTerms")}
            </Link>{" "}
            {t("agreeAnd")}{" "}
            <Link href="/privacy" className="border-b border-border text-foreground transition-colors hover:text-primary hover:border-primary">
              {t("agreePrivacy")}
            </Link>
            {t("agreeSuffix")}
          </span>
        </label>
        {errors.agreeTerms && (
          <span className="-mt-3 font-mono text-[11px] text-destructive">
            {errorMessage(errors.agreeTerms.message)}
          </span>
        )}

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

      {/* Alt action */}
      <div className="mt-6 text-center text-[13.5px] text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="border-b border-border pb-[1px] font-medium text-foreground transition-colors hover:text-primary hover:border-primary">
          {t("signIn")}
        </Link>
      </div>
    </div>
  );
}
