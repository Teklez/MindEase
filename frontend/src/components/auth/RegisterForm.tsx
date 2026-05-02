"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, setStoredToken } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PASSWORD_TESTS = {
  minChars: (p: string) => p.length >= 8,
  uppercase: (p: string) => /[A-Z]/.test(p),
  lowercase: (p: string) => /[a-z]/.test(p),
  number: (p: string) => /\d/.test(p),
} as const;

const schema = z
  .object({
    displayName: z.string().min(2),
    email: z.string().min(1).email(),
    password: z
      .string()
      .min(8)
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), { message: "weak" }),
    confirmPassword: z.string(),
    agree: z.literal(true).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "mismatch",
  });

type FormValues = z.infer<typeof schema>;

function passwordScore(p: string): 0 | 1 | 2 | 3 | 4 {
  const checks = [PASSWORD_TESTS.minChars(p), PASSWORD_TESTS.uppercase(p), PASSWORD_TESTS.lowercase(p), PASSWORD_TESTS.number(p)];
  const passed = checks.filter(Boolean).length;
  return passed as 0 | 1 | 2 | 3 | 4;
}

export default function RegisterForm() {
  const t = useTranslations("auth.register");
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
    mode: "onChange",
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const password = watch("password") ?? "";
  const confirm = watch("confirmPassword") ?? "";
  const score = passwordScore(password);
  const reqs = [
    { key: "minChars" as const, met: PASSWORD_TESTS.minChars(password) },
    { key: "uppercase" as const, met: PASSWORD_TESTS.uppercase(password) },
    { key: "lowercase" as const, met: PASSWORD_TESTS.lowercase(password) },
    { key: "number" as const, met: PASSWORD_TESTS.number(password) },
  ];

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

  const strengthLabel = (() => {
    if (!password) return null;
    if (score <= 1) return t("passwordStrength.weak");
    if (score === 2) return t("passwordStrength.okay");
    if (score === 3) return t("passwordStrength.good");
    return t("passwordStrength.strong");
  })();

  const strengthColor = (idx: number) => {
    if (idx >= score) return "bg-border";
    if (score === 1) return "bg-destructive";
    if (score === 2) return "bg-warning";
    if (score === 3) return "bg-accent";
    return "bg-success";
  };

  const passwordsMatch = confirm.length > 0 && confirm === password;
  const passwordsMismatch = confirm.length > 0 && confirm !== password;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {t("eyebrow")}
        </span>
        <h1 className="font-serif text-[34px] leading-[1.1] tracking-tight text-foreground md:text-[40px]">
          {t("title")}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {submitError && (
          <div
            className="animate-shake rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {submitError}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="reg-name" className="text-sm font-medium text-foreground">
            {t("displayName")}
          </label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            disabled={isSubmitting}
            aria-invalid={!!errors.displayName}
            className={cn("h-11 rounded-xl", errors.displayName && "border-destructive/60 animate-shake")}
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="text-xs text-destructive">{t("errors.nameTooShort")}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="reg-email" className="text-sm font-medium text-foreground">
            {t("email")}
          </label>
          <Input
            id="reg-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isSubmitting}
            aria-invalid={!!errors.email}
            className={cn("h-11 rounded-xl", errors.email && "border-destructive/60 animate-shake")}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{t("errors.invalidEmail")}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="reg-password" className="text-sm font-medium text-foreground">
            {t("password")}
          </label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              className={cn(
                "h-11 rounded-xl pr-11",
                errors.password && "border-destructive/60 animate-shake",
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {password && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn("h-1.5 rounded-full transition-colors", strengthColor(i))}
                    />
                  ))}
                </div>
                {strengthLabel && (
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {strengthLabel}
                  </span>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {reqs.map((r) => (
                  <li
                    key={r.key}
                    className={cn(
                      "flex items-center gap-1.5",
                      r.met ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {r.met ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-current" />
                    )}
                    {t(`requirements.${r.key}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="reg-confirm" className="text-sm font-medium text-foreground">
            {t("confirmPassword")}
          </label>
          <div className="relative">
            <Input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={passwordsMismatch}
              className={cn(
                "h-11 rounded-xl pr-11",
                passwordsMismatch && "border-destructive/60 animate-shake",
                passwordsMatch && "border-success/60",
              )}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordsMismatch && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {t("errors.passwordMismatch")}
            </p>
          )}
          {passwordsMatch && (
            <p className="flex items-center gap-1 text-xs text-success">
              <Check className="h-3.5 w-3.5" /> {t("passwordsMatch")}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-soft-sm hover:bg-primary/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("creatingAccount")}
            </>
          ) : (
            t("createAccount")
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <span className="relative flex justify-center bg-background px-4 text-xs uppercase tracking-wider text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>

        <GoogleSignInButton variant="signup" />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("agreePrefix")}{" "}
          <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
            {t("agreeTerm")}
          </Link>{" "}
          {t("agreeAnd")}{" "}
          <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
            {t("agreePrivacy")}
          </Link>
          {t("agreePeriod")}
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
