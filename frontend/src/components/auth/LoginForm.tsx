"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
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

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", remember: false },
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
          <label htmlFor="login-email" className="text-sm font-medium text-foreground">
            {t("email")}
          </label>
          <Input
            id="login-email"
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
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">
              {t("password")}
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
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
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring/30"
            {...register("remember")}
          />
          {t("rememberMe")}
        </label>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-soft-sm hover:bg-primary/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("signingIn")}
            </>
          ) : (
            t("signIn")
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

        <GoogleSignInButton variant="signin" />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
